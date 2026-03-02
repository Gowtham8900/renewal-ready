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
  users,
  renewalPackets,
  documents,
  handoffTokens,
  states,
  licenseTypes,
  requirementTemplates,
  organizations,
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
  createPacket(
    userId: number,
    data: Partial<RenewalPacket>,
  ): Promise<RenewalPacket>;
  updatePacket(id: number, data: UpdatePacket): Promise<RenewalPacket>;
  deletePacket(id: number): Promise<void>;

  getDocumentsByPacket(packetId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(data: Omit<Document, "id" | "createdAt">): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  updateDocumentValidation(
    id: number,
    status: string,
    notes: string | null,
  ): Promise<void>;

  createHandoffToken(
    packetId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<HandoffToken>;
  getHandoffTokenByHash(tokenHash: string): Promise<HandoffToken | undefined>;
  markTokenUsed(id: number): Promise<void>;
  revokeTokensForPacket(packetId: number): Promise<void>;

  getStates(): Promise<State[]>;
  getState(id: number): Promise<State | undefined>;
  createState(data: { code: string; name: string }): Promise<State>;
  getLicenseTypesByState(stateId: number): Promise<LicenseType[]>;
  getLicenseType(id: number): Promise<LicenseType | undefined>;
  createLicenseType(data: Omit<LicenseType, "id" | "createdAt">): Promise<LicenseType>;
  getRequirementsByLicenseType(licenseTypeId: number): Promise<RequirementTemplate[]>;
  createRequirementTemplate(data: Omit<RequirementTemplate, "id" | "createdAt">): Promise<RequirementTemplate>;

  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(data: { name: string; ownerId: number }): Promise<Organization>;

  getAdminStats(): Promise<{
    totalPackets: number;
    totalUsers: number;
    avgReadinessScore: number;
    coiFailRate: number;
    wcFailRate: number;
    incompleteItems: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash, name })
      .returning();
    return user;
  }

  async getPacketsByUser(userId: number): Promise<RenewalPacket[]> {
    return db
      .select()
      .from(renewalPackets)
      .where(eq(renewalPackets.userId, userId))
      .orderBy(desc(renewalPackets.createdAt));
  }

  async getPacket(id: number): Promise<RenewalPacket | undefined> {
    const [packet] = await db
      .select()
      .from(renewalPackets)
      .where(eq(renewalPackets.id, id));
    return packet;
  }

  async createPacket(
    userId: number,
    data: Partial<RenewalPacket>,
  ): Promise<RenewalPacket> {
    const [packet] = await db
      .insert(renewalPackets)
      .values({
        userId,
        title: data.title || "Renewal Packet",
        licenseType: data.licenseType || "Contractor",
        renewalYear: data.renewalYear,
        licenseNumberRaw: data.licenseNumberRaw,
        stateId: data.stateId,
        licenseTypeId: data.licenseTypeId,
      })
      .returning();
    return packet;
  }

  async updatePacket(id: number, data: UpdatePacket): Promise<RenewalPacket> {
    const [packet] = await db
      .update(renewalPackets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(renewalPackets.id, id))
      .returning();
    return packet;
  }

  async deletePacket(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.packetId, id));
    await db.delete(handoffTokens).where(eq(handoffTokens.packetId, id));
    await db.delete(renewalPackets).where(eq(renewalPackets.id, id));
  }

  async getDocumentsByPacket(packetId: number): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.packetId, packetId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(
    data: Omit<Document, "id" | "createdAt">,
  ): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async updateDocumentValidation(
    id: number,
    status: string,
    notes: string | null,
  ): Promise<void> {
    await db
      .update(documents)
      .set({ validationStatus: status, validationNotes: notes })
      .where(eq(documents.id, id));
  }

  async createHandoffToken(
    packetId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<HandoffToken> {
    const [token] = await db
      .insert(handoffTokens)
      .values({ packetId, tokenHash, expiresAt })
      .returning();
    return token;
  }

  async getHandoffTokenByHash(
    tokenHash: string,
  ): Promise<HandoffToken | undefined> {
    const [token] = await db
      .select()
      .from(handoffTokens)
      .where(eq(handoffTokens.tokenHash, tokenHash));
    return token;
  }

  async markTokenUsed(id: number): Promise<void> {
    await db
      .update(handoffTokens)
      .set({ usedAt: new Date() })
      .where(eq(handoffTokens.id, id));
  }

  async revokeTokensForPacket(packetId: number): Promise<void> {
    await db
      .update(handoffTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(handoffTokens.packetId, packetId),
          sql`${handoffTokens.revokedAt} IS NULL`,
        ),
      );
  }

  async getStates(): Promise<State[]> {
    return db.select().from(states).orderBy(states.name);
  }

  async getState(id: number): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.id, id));
    return state;
  }

  async createState(data: { code: string; name: string }): Promise<State> {
    const [state] = await db.insert(states).values(data).returning();
    return state;
  }

  async getLicenseTypesByState(stateId: number): Promise<LicenseType[]> {
    return db.select().from(licenseTypes).where(eq(licenseTypes.stateId, stateId)).orderBy(licenseTypes.name);
  }

  async getLicenseType(id: number): Promise<LicenseType | undefined> {
    const [lt] = await db.select().from(licenseTypes).where(eq(licenseTypes.id, id));
    return lt;
  }

  async createLicenseType(data: Omit<LicenseType, "id" | "createdAt">): Promise<LicenseType> {
    const [lt] = await db.insert(licenseTypes).values(data).returning();
    return lt;
  }

  async getRequirementsByLicenseType(licenseTypeId: number): Promise<RequirementTemplate[]> {
    return db.select().from(requirementTemplates).where(eq(requirementTemplates.licenseTypeId, licenseTypeId)).orderBy(requirementTemplates.sortOrder);
  }

  async createRequirementTemplate(data: Omit<RequirementTemplate, "id" | "createdAt">): Promise<RequirementTemplate> {
    const [rt] = await db.insert(requirementTemplates).values(data).returning();
    return rt;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(data: { name: string; ownerId: number }): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async getAdminStats() {
    const [packetCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(renewalPackets);
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const allCoiDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.type, "COI"));
    const failedCoi = allCoiDocs.filter(
      (d) => d.validationStatus === "FAIL",
    ).length;
    const coiFailRate =
      allCoiDocs.length > 0 ? (failedCoi / allCoiDocs.length) * 100 : 0;

    const allWcDocs = await db
      .select()
      .from(documents)
      .where(
        sql`${documents.type} IN ('WORKERS_COMP_CERT', 'WORKERS_COMP_WAIVER')`,
      );
    const failedWc = allWcDocs.filter(
      (d) => d.validationStatus === "FAIL",
    ).length;
    const wcFailRate =
      allWcDocs.length > 0 ? (failedWc / allWcDocs.length) * 100 : 0;

    const allPackets = await db.select().from(renewalPackets);
    const allDocs = await db.select().from(documents);

    let totalScore = 0;
    for (const p of allPackets) {
      const pDocs = allDocs.filter((d) => d.packetId === p.id);
      const { score } = calculateReadinessScore(p, pDocs);
      totalScore += score;
    }
    const avgReadinessScore =
      allPackets.length > 0 ? Math.round(totalScore / allPackets.length) : 0;

    const incompleteItems: Record<string, number> = {
      utahId: 0,
      myLicenseLinked: 0,
      ce: 0,
      entity: 0,
      liabilityCoi: 0,
      workersComp: 0,
      mandatoryDisclosure: 0,
      feeAcknowledged: 0,
    };

    for (const p of allPackets) {
      if (!p.hasUtahId) incompleteItems.utahId++;
      if (!p.isMyLicenseLinked) incompleteItems.myLicenseLinked++;
      if (!p.ceTotalHours || p.ceTotalHours < 6)
        incompleteItems.ce++;
      if (!p.entityRenewed) incompleteItems.entity++;
      if (!p.feeAcknowledged) incompleteItems.feeAcknowledged++;
      if (!p.mandatoryDisclosureReady) incompleteItems.mandatoryDisclosure++;
      if (p.workersCompPath === "NONE") incompleteItems.workersComp++;
    }

    return {
      totalPackets: packetCount.count,
      totalUsers: userCount.count,
      avgReadinessScore,
      coiFailRate: Math.round(coiFailRate),
      wcFailRate: Math.round(wcFailRate),
      incompleteItems,
    };
  }
}

export const storage = new DatabaseStorage();
