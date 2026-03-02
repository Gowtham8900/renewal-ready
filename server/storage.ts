import {
  type User,
  type RenewalPacket,
  type Document,
  type HandoffToken,
  type UpdatePacket,
  type State,
  type LicenseType,
  type RequirementTemplate,
  type Organization,
  type FrameworkTemplate,
  type ChecklistItemTemplate,
  type DocumentRuleTemplate,
  users,
  renewalPackets,
  documents,
  handoffTokens,
  states,
  licenseTypes,
  requirementTemplates,
  organizations,
  frameworkTemplates,
  checklistItemTemplates,
  documentRuleTemplates,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { calculateReadinessScore } from "./validation";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, passwordHash: string, name: string): Promise<User>;

  getPacketsByUser(userId: number): Promise<RenewalPacket[]>;
  getPacket(id: number): Promise<RenewalPacket | undefined>;
  createPacket(userId: number, data: Partial<RenewalPacket>): Promise<RenewalPacket>;
  updatePacket(id: number, data: UpdatePacket): Promise<RenewalPacket>;
  deletePacket(id: number): Promise<void>;

  getFrameworks(): Promise<FrameworkTemplate[]>;
  getFramework(id: string): Promise<FrameworkTemplate | undefined>;
  getChecklistItemsByFramework(frameworkId: string): Promise<ChecklistItemTemplate[]>;
  getDocumentRuleByChecklistItem(itemId: string): Promise<DocumentRuleTemplate | undefined>;

  getDocumentsByPacket(packetId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(data: Omit<Document, "id" | "createdAt">): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  createHandoffToken(packetId: number, tokenHash: string, expiresAt: Date): Promise<HandoffToken>;
  getHandoffTokenByHash(tokenHash: string): Promise<HandoffToken | undefined>;
  markTokenUsed(id: number): Promise<void>;
  revokeTokensForPacket(packetId: number): Promise<void>;

  getStates(): Promise<State[]>;
  getLicenseTypesByState(stateId: number): Promise<LicenseType[]>;
  getRequirementsByLicenseType(licenseTypeId: number): Promise<RequirementTemplate[]>;

  getAdminStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) { const [u] = await db.select().from(users).where(eq(users.id, id)); return u; }
  async getUserByEmail(email: string) { const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())); return u; }
  async createUser(email: string, passwordHash: string, name: string) {
    const [u] = await db.insert(users).values({ email: email.toLowerCase(), passwordHash, name }).returning();
    return u;
  }

  async getPacketsByUser(userId: number) {
    return db.select().from(renewalPackets).where(eq(renewalPackets.userId, userId)).orderBy(desc(renewalPackets.updatedAt));
  }
  async getPacket(id: number) {
    const [p] = await db.select().from(renewalPackets).where(eq(renewalPackets.id, id));
    return p;
  }
  async createPacket(userId: number, data: Partial<RenewalPacket>) {
    const [p] = await db.insert(renewalPackets).values({
      userId,
      title: data.title || "Readiness Packet",
      frameworkId: data.frameworkId || null,
      packetFieldsJson: data.packetFieldsJson || {},
      licenseType: data.licenseType || "General",
      renewalYear: data.renewalYear,
      licenseNumberRaw: data.licenseNumberRaw,
      stateId: data.stateId,
      licenseTypeId: data.licenseTypeId,
    }).returning();
    return p;
  }
  async updatePacket(id: number, data: UpdatePacket) {
    const [p] = await db.update(renewalPackets).set({ ...data, updatedAt: new Date() }).where(eq(renewalPackets.id, id)).returning();
    return p;
  }
  async deletePacket(id: number) {
    await db.delete(documents).where(eq(documents.packetId, id));
    await db.delete(handoffTokens).where(eq(handoffTokens.packetId, id));
    await db.delete(renewalPackets).where(eq(renewalPackets.id, id));
  }

  async getFrameworks() {
    return db.select().from(frameworkTemplates).where(eq(frameworkTemplates.isActive, true)).orderBy(frameworkTemplates.name);
  }
  async getFramework(id: string) {
    const [f] = await db.select().from(frameworkTemplates).where(eq(frameworkTemplates.id, id));
    return f;
  }
  async getChecklistItemsByFramework(frameworkId: string) {
    return db.select().from(checklistItemTemplates).where(eq(checklistItemTemplates.frameworkId, frameworkId)).orderBy(checklistItemTemplates.sortOrder);
  }
  async getDocumentRuleByChecklistItem(itemId: string) {
    const [r] = await db.select().from(documentRuleTemplates).where(eq(documentRuleTemplates.checklistItemTemplateId, itemId));
    return r;
  }

  async getDocumentsByPacket(packetId: number) {
    return db.select().from(documents).where(eq(documents.packetId, packetId)).orderBy(desc(documents.createdAt));
  }
  async getDocument(id: number) {
    const [d] = await db.select().from(documents).where(eq(documents.id, id));
    return d;
  }
  async createDocument(data: Omit<Document, "id" | "createdAt">) {
    const [d] = await db.insert(documents).values(data).returning();
    return d;
  }
  async deleteDocument(id: number) { await db.delete(documents).where(eq(documents.id, id)); }

  async createHandoffToken(packetId: number, tokenHash: string, expiresAt: Date) {
    const [t] = await db.insert(handoffTokens).values({ packetId, tokenHash, expiresAt }).returning();
    return t;
  }
  async getHandoffTokenByHash(tokenHash: string) {
    const [t] = await db.select().from(handoffTokens).where(eq(handoffTokens.tokenHash, tokenHash));
    return t;
  }
  async markTokenUsed(id: number) { await db.update(handoffTokens).set({ usedAt: new Date() }).where(eq(handoffTokens.id, id)); }
  async revokeTokensForPacket(packetId: number) {
    await db.update(handoffTokens).set({ revokedAt: new Date() }).where(and(eq(handoffTokens.packetId, packetId), sql`${handoffTokens.revokedAt} IS NULL`));
  }

  async getStates() { return db.select().from(states).orderBy(states.name); }
  async getLicenseTypesByState(stateId: number) { return db.select().from(licenseTypes).where(eq(licenseTypes.stateId, stateId)); }
  async getRequirementsByLicenseType(licenseTypeId: number) { return db.select().from(requirementTemplates).where(eq(requirementTemplates.licenseTypeId, licenseTypeId)); }

  async getAdminStats() {
    const packets = await db.select().from(renewalPackets);
    const usersCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const docs = await db.select().from(documents);
    let total = 0;
    for (const p of packets) {
      if (!p.frameworkId) continue;
      const items = await this.getChecklistItemsByFramework(p.frameworkId);
      const rules: Record<string, DocumentRuleTemplate | undefined> = {};
      for (const i of items) rules[i.id] = await this.getDocumentRuleByChecklistItem(i.id);
      const pd = docs.filter((d) => d.packetId === p.id);
      total += calculateReadinessScore(p, items, pd, rules).overallScore;
    }
    return {
      totalPackets: packets.length,
      totalUsers: usersCount[0].count,
      avgReadinessScore: packets.length ? Math.round(total / packets.length) : 0,
      coiFailRate: 0,
      wcFailRate: 0,
      incompleteItems: {},
    };
  }
}

export const storage = new DatabaseStorage();
