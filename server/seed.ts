import { storage } from "./storage";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users, states, licenseTypes, requirementTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await storage.getUserByEmail("demo@renewalready.com");
  if (existing) return;

  const hash = await bcrypt.hash("demo123", 10);
  const demoUser = await storage.createUser(
    "demo@renewalready.com",
    hash,
    "Demo Contractor",
  );

  const adminHash = await bcrypt.hash("admin123", 10);
  const adminUser = await storage.createUser(
    "admin@renewalready.com",
    adminHash,
    "Admin User",
  );

  await db
    .update(users)
    .set({ isAdmin: true, role: "ADMIN" })
    .where(eq(users.id, adminUser.id));

  const [utah] = await db
    .insert(states)
    .values({ code: "UT", name: "Utah" })
    .returning();

  const [contractorType] = await db
    .insert(licenseTypes)
    .values({
      stateId: utah.id,
      code: "CONTRACTOR",
      name: "General Contractor",
      renewalFee: 128,
      renewalCycleDays: 730,
      portalUrl: "https://utahdoc.mylicenseone.com",
    })
    .returning();

  const requirements = [
    { key: "utahId", label: "UtahID Account Ready", type: "boolean", weight: 10, sortOrder: 1, config: { helpUrl: "https://idhelp.utah.gov/" } },
    { key: "myLicenseLinked", label: "MyLicenseOne Linked", type: "boolean", weight: 15, sortOrder: 2, config: { helpUrl: "https://utahdoc.mylicenseone.com" } },
    { key: "ce", label: "Continuing Education", type: "ce_hours", weight: 10, sortOrder: 3, config: { minTotal: 6, minLive: 3 } },
    { key: "entity", label: "Business Entity Renewed", type: "boolean", weight: 10, sortOrder: 4, config: { helpUrl: "https://businessregistration.utah.gov" } },
    { key: "liabilityCoi", label: "Liability Insurance COI", type: "document", weight: 20, sortOrder: 5, config: { docType: "COI", validationTokens: ["dopl", "160", "300", "salt lake city", "84111"] } },
    { key: "workersComp", label: "Workers Compensation", type: "workers_comp", weight: 25, sortOrder: 6, config: { paths: ["CERTIFICATE", "WAIVER"] } },
    { key: "mandatoryDisclosure", label: "Mandatory Disclosure", type: "boolean", weight: 5, sortOrder: 7, config: {} },
    { key: "feeAcknowledged", label: "Renewal Fee Acknowledged", type: "fee", weight: 5, sortOrder: 8, config: { amount: 128 } },
  ];

  for (const req of requirements) {
    await db.insert(requirementTemplates).values({
      licenseTypeId: contractorType.id,
      key: req.key,
      label: req.label,
      type: req.type,
      weight: req.weight,
      sortOrder: req.sortOrder,
      config: req.config,
    });
  }

  await storage.createPacket(demoUser.id, {
    title: "2025 Contractor Renewal",
    licenseType: "Contractor",
    renewalYear: "2025",
    licenseNumberRaw: "12345678",
    stateId: utah.id,
    licenseTypeId: contractorType.id,
  } as any);

  console.log("Seed data created:");
  console.log("  Demo user: demo@renewalready.com / demo123");
  console.log("  Admin user: admin@renewalready.com / admin123");
  console.log("  Utah Contractor license type seeded with 8 requirement templates");
}
