import { type RenewalPacket, type Document, CHECKLIST_WEIGHTS } from "@shared/schema";

const DOPL_TOKENS = ["dopl", "160", "300", "salt lake city", "84111"];

export function validateCOI(text: string): { pass: boolean; missing: string[] } {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const missing: string[] = [];

  for (const token of DOPL_TOKENS) {
    if (!normalized.includes(token)) {
      missing.push(token);
    }
  }

  return { pass: missing.length === 0, missing };
}

export function validateWorkersCompCert(text: string): {
  pass: boolean;
  missing: string[];
} {
  return validateCOI(text);
}

export function validateWorkersCompWaiver(text: string): {
  pass: boolean;
  missing: string[];
} {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const hasWaiver = normalized.includes("waiver");
  const hasULC = normalized.includes("utah labor commission");
  const pass = hasWaiver || hasULC;
  const missing: string[] = [];
  if (!pass) {
    missing.push("waiver or Utah Labor Commission");
  }
  return { pass, missing };
}

export function formatLicenseNumber(raw: string): string {
  const cleaned = raw.replace(/\s/g, "").replace(/-/g, "");
  if (cleaned.length > 4) {
    return cleaned.slice(0, -4) + "-" + cleaned.slice(-4);
  }
  return cleaned;
}

export function validateWthId(wth: string): boolean {
  return /WTH$/i.test(wth.trim());
}

export function calculateReadinessScore(
  packet: RenewalPacket,
  docs: Document[],
): { score: number; items: Record<string, { complete: boolean; weight: number }> } {
  const coiDoc = docs.find((d) => d.type === "COI");
  const coiValid = coiDoc
    ? coiDoc.validationStatus === "PASS" || coiDoc.validationStatus === "MANUAL_CONFIRM"
    : false;

  const wcDocs = docs.filter(
    (d) => d.type === "WORKERS_COMP_CERT" || d.type === "WORKERS_COMP_WAIVER",
  );
  let wcComplete = false;
  if (packet.workersCompPath === "CERTIFICATE") {
    const cert = wcDocs.find((d) => d.type === "WORKERS_COMP_CERT");
    const certValid = cert
      ? cert.validationStatus === "PASS" || cert.validationStatus === "MANUAL_CONFIRM"
      : false;
    const hasIds =
      (!!packet.dwsUiNumber && !!packet.taxWithholdingWth) || packet.hasPeo;
    wcComplete = certValid && hasIds;
  } else if (packet.workersCompPath === "WAIVER") {
    const waiver = wcDocs.find((d) => d.type === "WORKERS_COMP_WAIVER");
    wcComplete = waiver
      ? waiver.validationStatus === "PASS" || waiver.validationStatus === "MANUAL_CONFIRM"
      : false;
  }

  const ceComplete =
    !!packet.ceTotalHours &&
    packet.ceTotalHours >= 6 &&
    !!packet.ceLiveHours &&
    packet.ceLiveHours >= 3;

  const items: Record<string, { complete: boolean; weight: number }> = {
    utahId: { complete: packet.hasUtahId, weight: CHECKLIST_WEIGHTS.utahId },
    myLicenseLinked: {
      complete: packet.isMyLicenseLinked,
      weight: CHECKLIST_WEIGHTS.myLicenseLinked,
    },
    ce: { complete: ceComplete, weight: CHECKLIST_WEIGHTS.ce },
    entity: { complete: packet.entityRenewed, weight: CHECKLIST_WEIGHTS.entity },
    liabilityCoi: { complete: coiValid, weight: CHECKLIST_WEIGHTS.liabilityCoi },
    workersComp: {
      complete: wcComplete,
      weight: CHECKLIST_WEIGHTS.workersComp,
    },
    mandatoryDisclosure: {
      complete: packet.mandatoryDisclosureReady,
      weight: CHECKLIST_WEIGHTS.mandatoryDisclosure,
    },
    feeAcknowledged: {
      complete: packet.feeAcknowledged,
      weight: CHECKLIST_WEIGHTS.feeAcknowledged,
    },
  };

  let score = 0;
  for (const item of Object.values(items)) {
    if (item.complete) score += item.weight;
  }

  return { score, items };
}

export const COI_EMAIL_TEMPLATE = `Subject: Update Certificate Holder for DOPL Renewal

Hello,

I am renewing my Utah contractor license through the Division of Professional Licensing (DOPL). Could you please update my Certificate of Insurance (COI) to list the following as the Certificate Holder:

Division of Professional Licensing (DOPL)
160 E 300 S
Salt Lake City, UT 84111

Please send me a PDF copy of the updated certificate.

Thank you.`;
