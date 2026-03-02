CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS framework_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  jurisdiction_type text NOT NULL DEFAULT 'NONE',
  jurisdiction_value text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES framework_templates(id),
  key text NOT NULL,
  label text NOT NULL,
  description text,
  input_type text NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_rule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_template_id uuid NOT NULL REFERENCES checklist_item_templates(id),
  rule_type text NOT NULL DEFAULT 'NONE',
  keywords text[],
  regex text,
  required_mime_types text[],
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE renewal_packets
  ADD COLUMN IF NOT EXISTS framework_id uuid REFERENCES framework_templates(id),
  ADD COLUMN IF NOT EXISTS packet_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS checklist_item_template_id uuid REFERENCES checklist_item_templates(id);

INSERT INTO framework_templates (name, description, category, jurisdiction_type, jurisdiction_value)
SELECT 'Legacy Utah Contractor License Renewal', 'Migrated from legacy renewal templates', 'License Renewal', 'STATE', 'UT'
WHERE NOT EXISTS (SELECT 1 FROM framework_templates WHERE name = 'Legacy Utah Contractor License Renewal');

UPDATE renewal_packets rp
SET packet_fields_json = jsonb_strip_nulls(jsonb_build_object(
  'account_linked', rp.is_my_license_linked,
  'ce_total_hours', rp.ce_total_hours,
  'entity_renewed', rp.entity_renewed,
  'fee_ack', rp.fee_acknowledged
))
WHERE rp.packet_fields_json = '{}'::jsonb;

UPDATE renewal_packets rp
SET framework_id = ft.id
FROM framework_templates ft
WHERE rp.framework_id IS NULL
  AND ft.name = 'Legacy Utah Contractor License Renewal';
