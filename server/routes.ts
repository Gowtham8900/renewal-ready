import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import session from "express-session";
import {
  signupSchema,
  loginSchema,
  updatePacketSchema,
  type DocumentType,
  type ValidationStatus,
} from "@shared/schema";
import {
  validateCOI,
  validateWorkersCompCert,
  validateWorkersCompWaiver,
  formatLicenseNumber,
  calculateReadinessScore,
  COI_EMAIL_TEMPLATE,
} from "./validation";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userId = (req as any).session?.userId || "unknown";
      const packetId = req.params.packetId || "unknown";
      const dir = path.join(UPLOAD_DIR, String(userId), String(packetId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const docType = req.body?.type || req.query?.type;
    const requiredTypes = [
      "COI",
      "WORKERS_COMP_CERT",
      "WORKERS_COMP_WAIVER",
    ];
    if (requiredTypes.includes(docType)) {
      if (file.mimetype !== "application/pdf") {
        cb(new Error("Required documents must be PDF files"));
        return;
      }
    }
    cb(null, true);
  },
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
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

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  let sessionStore: session.Store;
  if (isProduction && process.env.DATABASE_URL) {
    const connectPgSimple = (await import("connect-pg-simple")).default;
    const PgStore = connectPgSimple(session);
    sessionStore = new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    });
  } else {
    const MemoryStore = (await import("memorystore")).default(session);
    sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "renewal-ready-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? "lax" : undefined,
      },
    }),
  );

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0].message });
      }
      const { email, password, name } = parsed.data;
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser(email, passwordHash, name);
      req.session.userId = user.id;
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0].message });
      }
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.isAdmin,
    });
  });

  app.get("/api/packets", requireAuth, async (req, res) => {
    const packets = await storage.getPacketsByUser(req.session.userId!);
    res.json(packets);
  });

  app.post("/api/packets", requireAuth, async (req, res) => {
    try {
      const { title, licenseType, renewalYear, licenseNumberRaw } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Title is required" });
      }
      const packet = await storage.createPacket(req.session.userId!, {
        title,
        licenseType: licenseType || "Contractor",
        renewalYear: renewalYear || undefined,
        licenseNumberRaw: licenseNumberRaw || undefined,
      } as any);
      res.json(packet);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/packets/:id", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId!) {
      return res.status(404).json({ message: "Packet not found" });
    }
    const docs = await storage.getDocumentsByPacket(packet.id);
    const readiness = calculateReadinessScore(packet, docs);
    res.json({ ...packet, documents: docs, readiness });
  });

  app.patch("/api/packets/:id", requireAuth, async (req, res) => {
    try {
      const packet = await storage.getPacket(parseInt(req.params.id));
      if (!packet || packet.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Packet not found" });
      }

      const allowedFields = [
        "title", "licenseType", "licenseNumberRaw", "renewalYear",
        "ceTotalHours", "ceLiveHours", "hasUtahId", "isMyLicenseLinked",
        "entityRenewed", "entityNumber", "workersCompPath", "dwsUiNumber",
        "taxWithholdingWth", "hasPeo", "mandatoryDisclosureReady",
        "mandatoryDisclosureNote", "feeAcknowledged",
      ];
      const data: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) data[key] = req.body[key];
      }
      if (data.licenseNumberRaw) {
        data.licenseNumberFormatted = formatLicenseNumber(
          data.licenseNumberRaw,
        );
      }

      const updated = await storage.updatePacket(packet.id, data);
      const docs = await storage.getDocumentsByPacket(packet.id);
      const readiness = calculateReadinessScore(updated, docs);
      res.json({ ...updated, documents: docs, readiness });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/packets/:id", requireAuth, async (req, res) => {
    const packet = await storage.getPacket(parseInt(req.params.id));
    if (!packet || packet.userId !== req.session.userId!) {
      return res.status(404).json({ message: "Packet not found" });
    }
    await storage.deletePacket(packet.id);
    res.json({ message: "Deleted" });
  });

  app.post(
    "/api/packets/:packetId/documents",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      try {
        const packet = await storage.getPacket(
          parseInt(req.params.packetId),
        );
        if (!packet || packet.userId !== req.session.userId!) {
          return res.status(404).json({ message: "Packet not found" });
        }
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const docType = (req.body.type || "OTHER") as DocumentType;
        const requiredPdfTypes = ["COI", "WORKERS_COMP_CERT", "WORKERS_COMP_WAIVER"];
        if (requiredPdfTypes.includes(docType) && req.file.mimetype !== "application/pdf") {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Required documents must be PDF files" });
        }

        let extractedText: string | null = null;
        let validationStatus: ValidationStatus = "UNKNOWN";
        let validationNotes: string | null = null;

        if (req.file.mimetype === "application/pdf") {
          extractedText = await extractPdfText(req.file.path);
        }

        if (extractedText) {
          if (docType === "COI") {
            const result = validateCOI(extractedText);
            validationStatus = result.pass ? "PASS" : "FAIL";
            if (!result.pass) {
              validationNotes = `Missing: ${result.missing.join(", ")}. The certificate holder must list DOPL at 160 E 300 S, Salt Lake City, UT 84111.`;
            }
          } else if (docType === "WORKERS_COMP_CERT") {
            const result = validateWorkersCompCert(extractedText);
            validationStatus = result.pass ? "PASS" : "FAIL";
            if (!result.pass) {
              validationNotes = `Missing: ${result.missing.join(", ")}`;
            }
          } else if (docType === "WORKERS_COMP_WAIVER") {
            const result = validateWorkersCompWaiver(extractedText);
            validationStatus = result.pass ? "PASS" : "FAIL";
            if (!result.pass) {
              validationNotes = `Missing: ${result.missing.join(", ")}`;
            }
          }
        } else if (
          ["COI", "WORKERS_COMP_CERT", "WORKERS_COMP_WAIVER"].includes(
            docType,
          )
        ) {
          validationStatus = "UNKNOWN";
          validationNotes =
            "Could not extract text from PDF. Please confirm the document manually.";
        }

        const doc = await storage.createDocument({
          packetId: packet.id,
          type: docType,
          filePath: req.file.path,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          extractedText,
          validationStatus,
          validationNotes,
        });

        res.json(doc);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.patch(
    "/api/documents/:id/confirm",
    requireAuth,
    async (req, res) => {
      try {
        const doc = await storage.getDocument(parseInt(req.params.id));
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }
        const packet = await storage.getPacket(doc.packetId);
        if (!packet || packet.userId !== req.session.userId!) {
          return res.status(403).json({ message: "Forbidden" });
        }
        await storage.updateDocumentValidation(
          doc.id,
          "MANUAL_CONFIRM",
          "Manually confirmed by user",
        );
        res.json({ message: "Confirmed" });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      const packet = await storage.getPacket(doc.packetId);
      if (!packet || packet.userId !== req.session.userId!) {
        return res.status(403).json({ message: "Forbidden" });
      }
      try {
        fs.unlinkSync(doc.filePath);
      } catch {}
      await storage.deleteDocument(doc.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const packet = await storage.getPacket(doc.packetId);
      if (!packet) {
        return res.status(404).json({ message: "Packet not found" });
      }

      const isOwner = req.session.userId === packet.userId;

      const tokenParam = req.query.token as string;
      let isValidToken = false;
      if (tokenParam) {
        const tokenHash = crypto
          .createHash("sha256")
          .update(tokenParam)
          .digest("hex");
        const ht = await storage.getHandoffTokenByHash(tokenHash);
        if (
          ht &&
          ht.packetId === packet.id &&
          !ht.revokedAt &&
          new Date() < new Date(ht.expiresAt)
        ) {
          isValidToken = true;
        }
      }

      if (!isOwner && !isValidToken) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const safePath = path.resolve(doc.filePath);
      if (!safePath.startsWith(path.resolve(UPLOAD_DIR))) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${doc.originalName}"`,
      );
      res.setHeader("Content-Type", doc.mimeType);
      fs.createReadStream(safePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/packets/:id/handoff",
    requireAuth,
    async (req, res) => {
      try {
        const packet = await storage.getPacket(parseInt(req.params.id));
        if (!packet || packet.userId !== req.session.userId!) {
          return res.status(404).json({ message: "Packet not found" });
        }

        await storage.revokeTokensForPacket(packet.id);

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
          .createHash("sha256")
          .update(rawToken)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await storage.createHandoffToken(packet.id, tokenHash, expiresAt);

        res.json({ token: rawToken, expiresAt: expiresAt.toISOString() });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.get("/api/handoff/:token", async (req, res) => {
    try {
      const tokenHash = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");
      const ht = await storage.getHandoffTokenByHash(tokenHash);

      if (!ht) {
        return res.status(404).json({ message: "Invalid or expired link" });
      }
      if (ht.revokedAt) {
        return res.status(410).json({ message: "This link has been revoked" });
      }
      if (new Date() > new Date(ht.expiresAt)) {
        return res.status(410).json({ message: "This link has expired" });
      }

      if (!ht.usedAt) {
        await storage.markTokenUsed(ht.id);
      }

      const packet = await storage.getPacket(ht.packetId);
      if (!packet) {
        return res.status(404).json({ message: "Packet not found" });
      }

      const docs = await storage.getDocumentsByPacket(packet.id);
      const readiness = calculateReadinessScore(packet, docs);
      const user = await storage.getUser(packet.userId);

      res.json({
        packet: { ...packet, documents: docs, readiness },
        user: user
          ? { name: user.name, email: user.email }
          : null,
        token: req.params.token,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  app.get("/api/states", async (_req, res) => {
    const allStates = await storage.getStates();
    res.json(allStates);
  });

  app.get("/api/states/:stateId/license-types", async (req, res) => {
    const types = await storage.getLicenseTypesByState(parseInt(req.params.stateId));
    res.json(types);
  });

  app.get("/api/license-types/:id/requirements", async (req, res) => {
    const reqs = await storage.getRequirementsByLicenseType(parseInt(req.params.id));
    res.json(reqs);
  });

  app.post("/api/billing/create-checkout", requireAuth, async (_req, res) => {
    res.status(501).json({
      message: "Stripe billing integration coming soon. Free during beta.",
    });
  });

  app.get("/api/billing/subscription", requireAuth, async (_req, res) => {
    res.json({
      status: "beta",
      plan: "free",
      message: "All features are free during the beta period.",
    });
  });

  app.post("/api/billing/webhook", async (_req, res) => {
    res.json({ received: true });
  });

  app.get("/api/coi-email-template", (_req, res) => {
    res.json({ template: COI_EMAIL_TEMPLATE });
  });

  return httpServer;
}
