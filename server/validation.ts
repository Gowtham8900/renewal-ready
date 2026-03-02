import type {
  ChecklistItemTemplate,
  Document,
  DocumentRuleTemplate,
  RenewalPacket,
} from "@shared/schema";

export type ItemStatus = {
  key: string;
  label: string;
  isComplete: boolean;
  statusType: "PASS" | "FAIL" | "MANUAL" | "MISSING";
  message?: string;
  weight: number;
};

function isValidSelect(value: unknown, options: unknown): boolean {
  if (!Array.isArray(options)) return !!value;
  return options.includes(value);
}

export function evaluateDocumentRule(
  extractedText: string | null,
  rule: DocumentRuleTemplate | undefined,
): { status: "PASS" | "FAIL" | "MANUAL"; message?: string } {
  if (!rule || rule.ruleType === "NONE") return { status: "PASS" };
  if (rule.ruleType === "MANUAL") {
    return { status: "MANUAL", message: rule.notes || "Manual review required." };
  }

  const normalized = (extractedText || "").toLowerCase();

  if (rule.ruleType === "KEYWORDS") {
    const keywords = rule.keywords || [];
    const missing = keywords.filter((k) => !normalized.includes(k.toLowerCase()));
    return missing.length
      ? { status: "FAIL", message: `Missing keywords: ${missing.join(", ")}` }
      : { status: "PASS" };
  }

  if (rule.ruleType === "REGEX") {
    if (!rule.regex) return { status: "PASS" };
    try {
      const pattern = new RegExp(rule.regex, "i");
      return pattern.test(extractedText || "")
        ? { status: "PASS" }
        : { status: "FAIL", message: "Document did not match expected pattern." };
    } catch {
      return { status: "MANUAL", message: "Invalid regex rule; manual review required." };
    }
  }

  return { status: "PASS" };
}

export function calculateReadinessScore(
  packet: RenewalPacket,
  templates: ChecklistItemTemplate[],
  docs: Document[],
  rulesByItemId: Record<string, DocumentRuleTemplate | undefined> = {},
): { overallScore: number; itemStatus: ItemStatus[] } {
  const fields = (packet.packetFieldsJson || {}) as Record<string, any>;
  let requiredWeightTotal = 0;
  let completedWeightTotal = 0;

  const itemStatus: ItemStatus[] = templates
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const value = fields[item.key];
      const config = (item.configJson || {}) as Record<string, any>;
      const linkedDocs = docs.filter((d) => d.checklistItemTemplateId === item.id);
      let isComplete = false;
      let statusType: ItemStatus["statusType"] = "MISSING";
      let message = "";

      if (item.inputType === "BOOLEAN") {
        isComplete = value === true;
        statusType = isComplete ? "PASS" : "MISSING";
      } else if (item.inputType === "NUMBER") {
        const num = value === null || value === undefined || value === "" ? null : Number(value);
        const min = typeof config.min === "number" ? config.min : null;
        isComplete = num !== null && !Number.isNaN(num) && (min === null || num >= min);
        statusType = isComplete ? "PASS" : "MISSING";
      } else if (item.inputType === "TEXT") {
        isComplete = typeof value === "string" && value.trim().length > 0;
        statusType = isComplete ? "PASS" : "MISSING";
      } else if (item.inputType === "SELECT") {
        isComplete = isValidSelect(value, config.options);
        statusType = isComplete ? "PASS" : "MISSING";
      } else if (item.inputType === "FILE") {
        if (!linkedDocs.length) {
          isComplete = false;
          statusType = "MISSING";
          message = "No file uploaded yet.";
        } else {
          const lastDoc = linkedDocs[0];
          const ruleResult = evaluateDocumentRule(lastDoc.extractedText, rulesByItemId[item.id]);
          if (ruleResult.status === "PASS") {
            isComplete = true;
            statusType = "PASS";
          } else if (ruleResult.status === "MANUAL") {
            isComplete = true;
            statusType = "MANUAL";
            message = ruleResult.message || "Needs manual review.";
          } else {
            isComplete = false;
            statusType = "FAIL";
            message = ruleResult.message || "Validation failed.";
          }
        }
      }

      if (item.isRequired) {
        requiredWeightTotal += item.weight;
        if (isComplete) completedWeightTotal += item.weight;
      }

      return { key: item.key, label: item.label, isComplete, statusType, message, weight: item.weight };
    });

  const overallScore = requiredWeightTotal
    ? Math.round((completedWeightTotal / requiredWeightTotal) * 100)
    : 0;

  return { overallScore, itemStatus };
}
