import { storage } from "./storage";
import bcrypt from "bcrypt";
import { db } from "./db";
import {
  users,
  frameworkTemplates,
  checklistItemTemplates,
  documentRuleTemplates,
  renewalPackets,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await storage.getUserByEmail("demo@renewalready.com");
  if (existing) return;

  const demoUser = await storage.createUser("demo@renewalready.com", await bcrypt.hash("demo123", 10), "Demo User");
  const adminUser = await storage.createUser("admin@renewalready.com", await bcrypt.hash("admin123", 10), "Admin User");
  await db.update(users).set({ isAdmin: true, role: "ADMIN" }).where(eq(users.id, adminUser.id));

  const [utahFramework] = await db.insert(frameworkTemplates).values({
    name: "Utah Contractor License Renewal",
    description: "State template for contractor license readiness.",
    category: "License Renewal",
    jurisdictionType: "STATE",
    jurisdictionValue: "UT",
  }).returning();

  const [businessFramework] = await db.insert(frameworkTemplates).values({
    name: "Annual Business Compliance",
    description: "General business readiness checklist for annual compliance tasks.",
    category: "Compliance",
    jurisdictionType: "NONE",
  }).returning();

  const utahItems = await db.insert(checklistItemTemplates).values([
    { frameworkId: utahFramework.id, key: "account_linked", label: "Portal Account Linked", inputType: "BOOLEAN", weight: 15, sortOrder: 1, isRequired: true },
    { frameworkId: utahFramework.id, key: "ce_hours", label: "Continuing Education Hours", inputType: "NUMBER", configJson: { min: 6 }, weight: 10, sortOrder: 2, isRequired: true },
    { frameworkId: utahFramework.id, key: "insurance_coi", label: "Insurance Certificate", inputType: "FILE", weight: 25, sortOrder: 3, isRequired: true },
    { frameworkId: utahFramework.id, key: "entity_status", label: "Entity Renewal Confirmed", inputType: "BOOLEAN", weight: 15, sortOrder: 4, isRequired: true },
    { frameworkId: utahFramework.id, key: "fee_ack", label: "Fee Acknowledged", inputType: "BOOLEAN", weight: 10, sortOrder: 5, isRequired: true },
  ]).returning();

  const coiItem = utahItems.find((i) => i.key === "insurance_coi");
  if (coiItem) {
    await db.insert(documentRuleTemplates).values({
      checklistItemTemplateId: coiItem.id,
      ruleType: "KEYWORDS",
      keywords: ["division of professional licensing", "salt lake city"],
      requiredMimeTypes: ["application/pdf"],
      notes: "COI should include the expected certificate holder details.",
    });
  }

  await db.insert(checklistItemTemplates).values([
    { frameworkId: businessFramework.id, key: "policy_review", label: "Annual policy review complete", inputType: "BOOLEAN", weight: 30, sortOrder: 1, isRequired: true },
    { frameworkId: businessFramework.id, key: "risk_notes", label: "Risk register notes", inputType: "TEXT", weight: 20, sortOrder: 2, isRequired: true },
    { frameworkId: businessFramework.id, key: "compliance_report", label: "Upload compliance report", inputType: "FILE", weight: 50, sortOrder: 3, isRequired: true },
  ]);

  await db.insert(renewalPackets).values({
    userId: demoUser.id,
    title: "Utah Renewal Packet",
    frameworkId: utahFramework.id,
    packetFieldsJson: { account_linked: false },
  });

  console.log("Seed data created: demo/admin users + Utah and Business frameworks");
}
