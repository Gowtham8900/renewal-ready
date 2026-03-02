import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import session from "express-session";
import { signupSchema, loginSchema, type ValidationStatus } from "@shared/schema";
import { calculateReadinessScore, evaluateDocumentRule } from "./validation";

declare module "express-session" { interface SessionData { userId?: number; } }

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = (req as any).session?.userId || "unknown";
      const packetId = req.params.packetId || "unknown";
      const dir = path.join(UPLOAD_DIR, String(userId), String(packetId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  next();
}

async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || null;
  } catch {
    return null;
  }
}

export async function registerRoutes(_httpServer: Server, app: Express): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) app.set("trust proxy", 1);

  let sessionStore: session.Store;
  if (isProduction && process.env.DATABASE_URL) {
    const connectPgSimple = (await import("connect-pg-simple")).default;
    const PgStore = connectPgSimple(session);
    sessionStore = new PgStore({ conString: process.env.DATABASE_URL, createTableIfMissing: true });
  } else {
    const MemoryStore = (await import("memorystore")).default(session);
    sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "readiness-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProduction, httpOnly: true, maxAge: 86400000, sameSite: isProduction ? "lax" : undefined },
  }));

  app.post("/api/auth/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { email, password, name } = parsed.data;
    if (await storage.getUserByEmail(email)) return res.status(409).json({ message: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser(email, passwordHash, name);
    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin });
  });
  app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ message: "Logged out" })));
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin });
  });

  app.get("/api/frameworks", async (_req, res) => res.json(await storage.getFrameworks()));
  app.get("/api/frameworks/:id", async (req, res) => {
    const f = await storage.getFramework(req.params.id);
    if (!f) return res.status(404).json({ message: "Framework not found" });
    res.json(f);
  });
  app.get("/api/frameworks/:id/checklist-items", async (req, res) => res.json(await storage.getChecklistItemsByFramework(req.params.id)));

  app.get("/api/packets", requireAuth, async (req, res) => res.json(await storage.getPacketsByUser(req.session.userId!)));
  app.post("/api/packets", requireAuth, async (req, res) => {
    const { title, frameworkId } = req.body;
    if (!frameworkId) return res.status(400).json({ message: "frameworkId is required" });
    const packet = await storage.createPacket(req.session.userId!, { title: title || "Readiness Packet", frameworkId, packetFieldsJson: {} } as any);
    res.json(packet);
  });
  app.get("/api/packets/:id", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId) return res.status(404).json({ message: "Packet not found" });
    const docs = await storage.getDocumentsByPacket(packet.id);
    const framework = packet.frameworkId ? await storage.getFramework(packet.frameworkId) : null;
    const checklist = packet.frameworkId ? await storage.getChecklistItemsByFramework(packet.frameworkId) : [];
    const rulesByItemId: Record<string, any> = {};
    for (const item of checklist) rulesByItemId[item.id] = await storage.getDocumentRuleByChecklistItem(item.id);
    const readiness = calculateReadinessScore(packet, checklist, docs, rulesByItemId);
    res.json({ ...packet, framework, checklist, documents: docs, readiness });
  });
  app.put("/api/packets/:id", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId) return res.status(404).json({ message: "Packet not found" });
    const merged = { ...(packet.packetFieldsJson || {}), ...(req.body.packetFieldsJson || {}) };
    const updated = await storage.updatePacket(packet.id, { packetFieldsJson: merged } as any);
    res.json(updated);
  });
  app.delete("/api/packets/:id", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId) return res.status(404).json({ message: "Packet not found" });
    await storage.deletePacket(packet.id);
    res.json({ message: "Deleted" });
  });

  app.post("/api/packets/:packetId/documents", requireAuth, upload.single("file"), async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.packetId));
    if (!packet || packet.userId !== req.session.userId) return res.status(404).json({ message: "Packet not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const checklistItemTemplateId = req.body.checklistItemTemplateId as string;
    const rule = checklistItemTemplateId ? await storage.getDocumentRuleByChecklistItem(checklistItemTemplateId) : undefined;

    if (rule?.requiredMimeTypes?.length && !rule.requiredMimeTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: `Invalid file type. Allowed: ${rule.requiredMimeTypes.join(", ")}` });
    }

    const extractedText = req.file.mimetype === "application/pdf" ? await extractPdfText(req.file.path) : null;
    const result = evaluateDocumentRule(extractedText, rule);
    const validationStatus: ValidationStatus = result.status === "MANUAL" ? "MANUAL_CONFIRM" : result.status;

    const doc = await storage.createDocument({
      packetId: packet.id,
      checklistItemTemplateId: checklistItemTemplateId || null,
      type: "CHECKLIST_FILE",
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      extractedText,
      validationStatus,
      validationNotes: result.message || null,
    } as any);
    res.json(doc);
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const packet = await storage.getPacket(doc.packetId);
    if (!packet || packet.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
    try { fs.unlinkSync(doc.filePath); } catch {}
    await storage.deleteDocument(doc.id);
    res.json({ message: "Deleted" });
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const packet = await storage.getPacket(doc.packetId);
    if (!packet) return res.status(404).json({ message: "Packet not found" });

    const isOwner = req.session.userId === packet.userId;
    const tokenParam = req.query.token as string;
    let isValidToken = false;
    if (tokenParam) {
      const tokenHash = crypto.createHash("sha256").update(tokenParam).digest("hex");
      const ht = await storage.getHandoffTokenByHash(tokenHash);
      if (ht && ht.packetId === packet.id && !ht.revokedAt && new Date() < new Date(ht.expiresAt)) isValidToken = true;
    }
    if (!isOwner && !isValidToken) return res.status(403).json({ message: "Forbidden" });

    if (!fs.existsSync(doc.filePath)) return res.status(404).json({ message: "File not found" });
    res.setHeader("Content-Disposition", `attachment; filename=\"${doc.originalName}\"`);
    res.setHeader("Content-Type", doc.mimeType);
    fs.createReadStream(doc.filePath).pipe(res);
  });

  app.post("/api/packets/:id/handoff", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId) return res.status(404).json({ message: "Packet not found" });
    await storage.revokeTokensForPacket(packet.id);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.createHandoffToken(packet.id, tokenHash, expiresAt);
    res.json({ token: rawToken, expiresAt: expiresAt.toISOString() });
  });

  app.get("/api/handoff/:token", async (req, res) => {
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const ht = await storage.getHandoffTokenByHash(tokenHash);
    if (!ht || ht.revokedAt || new Date() > new Date(ht.expiresAt)) return res.status(404).json({ message: "Invalid or expired link" });
    if (!ht.usedAt) await storage.markTokenUsed(ht.id);
    const packet = await storage.getPacket(ht.packetId);
    if (!packet) return res.status(404).json({ message: "Packet not found" });
    const docs = await storage.getDocumentsByPacket(packet.id);
    const framework = packet.frameworkId ? await storage.getFramework(packet.frameworkId) : null;
    const checklist = packet.frameworkId ? await storage.getChecklistItemsByFramework(packet.frameworkId) : [];
    const rulesByItemId: Record<string, any> = {};
    for (const item of checklist) rulesByItemId[item.id] = await storage.getDocumentRuleByChecklistItem(item.id);
    const readiness = calculateReadinessScore(packet, checklist, docs, rulesByItemId);
    const user = await storage.getUser(packet.userId);
    res.json({ packet: { ...packet, framework, checklist, documents: docs, readiness }, user: user ? { name: user.name, email: user.email } : null, token: req.params.token });
  });

  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    res.json(await storage.getAdminStats());
  });

  return _httpServer;
}
