import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  serial,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const licenseTypes = pgTable("license_types", {
  id: serial("id").primaryKey(),
  stateId: integer("state_id")
    .notNull()
    .references(() => states.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  renewalFee: integer("renewal_fee"),
  renewalCycleDays: integer("renewal_cycle_days"),
  portalUrl: text("portal_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const requirementTemplates = pgTable("requirement_templates", {
  id: serial("id").primaryKey(),
  licenseTypeId: integer("license_type_id")
    .notNull()
    .references(() => licenseTypes.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  weight: integer("weight").notNull().default(0),
  config: jsonb("config"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const frameworkTemplates = pgTable("framework_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  jurisdictionType: text("jurisdiction_type").notNull().default("NONE"),
  jurisdictionValue: text("jurisdiction_value"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checklistItemTemplates = pgTable("checklist_item_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  frameworkId: uuid("framework_id")
    .notNull()
    .references(() => frameworkTemplates.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  configJson: jsonb("config_json").notNull().default({}),
  weight: integer("weight").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentRuleTemplates = pgTable("document_rule_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  checklistItemTemplateId: uuid("checklist_item_template_id")
    .notNull()
    .references(() => checklistItemTemplates.id),
  ruleType: text("rule_type").notNull().default("NONE"),
  keywords: text("keywords").array(),
  regex: text("regex"),
  requiredMimeTypes: text("required_mime_types").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status").default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("USER"),
  isAdmin: boolean("is_admin").notNull().default(false),
  organizationId: integer("organization_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const renewalPackets = pgTable("renewal_packets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  frameworkId: uuid("framework_id").references(() => frameworkTemplates.id),
  packetFieldsJson: jsonb("packet_fields_json").notNull().default({}),
  stateId: integer("state_id"),
  licenseTypeId: integer("license_type_id"),
  title: text("title").notNull(),
  licenseType: text("license_type").notNull().default("Contractor"),
  licenseNumberRaw: text("license_number_raw"),
  licenseNumberFormatted: text("license_number_formatted"),
  renewalYear: text("renewal_year"),
  ceTotalHours: integer("ce_total_hours"),
  ceLiveHours: integer("ce_live_hours"),
  hasUtahId: boolean("has_utah_id").notNull().default(false),
  isMyLicenseLinked: boolean("is_my_license_linked").notNull().default(false),
  entityRenewed: boolean("entity_renewed").notNull().default(false),
  entityNumber: text("entity_number"),
  workersCompPath: text("workers_comp_path").notNull().default("NONE"),
  dwsUiNumber: text("dws_ui_number"),
  taxWithholdingWth: text("tax_withholding_wth"),
  hasPeo: boolean("has_peo").notNull().default(false),
  mandatoryDisclosureReady: boolean("mandatory_disclosure_ready")
    .notNull()
    .default(false),
  mandatoryDisclosureNote: text("mandatory_disclosure_note"),
  feeAcknowledged: boolean("fee_acknowledged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  packetId: integer("packet_id")
    .notNull()
    .references(() => renewalPackets.id),
  checklistItemTemplateId: uuid("checklist_item_template_id").references(
    () => checklistItemTemplates.id,
  ),
  type: text("type").notNull(),
  filePath: text("file_path").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  extractedText: text("extracted_text"),
  validationStatus: text("validation_status").notNull().default("UNKNOWN"),
  validationNotes: text("validation_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const handoffTokens = pgTable("handoff_tokens", {
  id: serial("id").primaryKey(),
  packetId: integer("packet_id")
    .notNull()
    .references(() => renewalPackets.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
  usedAt: timestamp("used_at"),
});

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const insertPacketSchema = createInsertSchema(renewalPackets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePacketSchema = insertPacketSchema.partial();
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type RenewalPacket = typeof renewalPackets.$inferSelect;
export type ReadinessPacket = RenewalPacket;
export type UpdatePacket = z.infer<typeof updatePacketSchema>;
export type Document = typeof documents.$inferSelect;
export type HandoffToken = typeof handoffTokens.$inferSelect;
export type State = typeof states.$inferSelect;
export type LicenseType = typeof licenseTypes.$inferSelect;
export type RequirementTemplate = typeof requirementTemplates.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type FrameworkTemplate = typeof frameworkTemplates.$inferSelect;
export type ChecklistItemTemplate = typeof checklistItemTemplates.$inferSelect;
export type DocumentRuleTemplate = typeof documentRuleTemplates.$inferSelect;

export type DocumentType = "CHECKLIST_FILE" | "OTHER";
export type ValidationStatus = "PASS" | "FAIL" | "MANUAL_CONFIRM" | "UNKNOWN";
