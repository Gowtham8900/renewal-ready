import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Download,
  Copy,
  ExternalLink,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  Monitor,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { RenewalPacket, Document as DocType } from "@shared/schema";

type HandoffData = {
  packet: RenewalPacket & {
    documents: DocType[];
    readiness: {
      score: number;
      items: Record<string, { complete: boolean; weight: number }>;
    };
  };
  user: { name: string; email: string } | null;
  token: string;
};

function CopyField({ label, value, token }: { label: string; value: string; token?: string }) {
  const { toast } = useToast();
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate" data-testid={`text-field-${label.toLowerCase().replace(/\s/g, "-")}`}>
          {value}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast({ title: `${label} copied` });
        }}
        data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <Copy className="mr-1 h-3 w-3" />
        Copy
      </Button>
    </div>
  );
}

export default function Handoff() {
  const [, params] = useRoute("/handoff/:token");
  const { toast } = useToast();
  const token = params?.token;

  const { data, isLoading, error } = useQuery<HandoffData>({
    queryKey: ["/api/handoff", token],
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-sm w-full border-card-border">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-semibold text-lg">Invalid or Expired Link</h2>
            <p className="text-sm text-muted-foreground">
              This handoff link is no longer valid. It may have expired or been
              revoked. Generate a new one from the mobile app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { packet, user } = data;
  const score = packet.readiness?.score ?? 0;
  const items = packet.readiness?.items ?? {};
  const docs = packet.documents ?? [];

  const scoreBadgeColor =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 40
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  const checklistLabels: Record<string, string> = {
    utahId: "UtahID Ready",
    myLicenseLinked: "MyLicenseOne Linked",
    ce: "Continuing Education",
    entity: "Business Entity Renewed",
    liabilityCoi: "Liability Insurance COI",
    workersComp: "Workers Compensation",
    mandatoryDisclosure: "Mandatory Disclosure",
    feeAcknowledged: "Renewal Fee ($128)",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <div>
              <span className="font-semibold">Renewal Ready</span>
              <span className="text-xs text-muted-foreground ml-2">
                Desktop Handoff
              </span>
            </div>
          </div>
          <div className={`text-sm font-bold px-3 py-1 rounded-full ${scoreBadgeColor}`} data-testid="text-handoff-score">
            {score}% Ready
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {user && (
          <div className="text-sm text-muted-foreground">
            Packet for <span className="font-medium text-foreground">{user.name}</span> ({user.email})
          </div>
        )}

        <Card className="border-card-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold" data-testid="text-handoff-title">{packet.title}</h2>
              <span className="text-2xl font-bold">{score}/100</span>
            </div>
            <Progress value={score} className="h-3" />

            <div className="grid sm:grid-cols-2 gap-2">
              {Object.entries(items).map(([key, item]) => (
                <div key={key} className="flex items-center gap-2 py-1">
                  {item.complete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm ${item.complete ? "" : "text-muted-foreground"}`}
                  >
                    {checklistLabels[key] || key}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {item.weight}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="https://utahdoc.mylicenseone.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full" size="lg" data-testid="button-open-mylicenseone">
              <Monitor className="mr-2 h-5 w-5" />
              Open MyLicenseOne
            </Button>
          </a>
          <a
            href="https://idhelp.utah.gov/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full" size="lg" data-testid="button-utahid-help">
              <HelpCircle className="mr-2 h-5 w-5" />
              UtahID Help
            </Button>
          </a>
        </div>

        {docs.length > 0 && (
          <Card className="border-card-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">Documents</h3>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0"
                    data-testid={`doc-row-${doc.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{doc.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type.replace(/_/g, " ")} &middot;{" "}
                          {doc.validationStatus === "PASS"
                            ? "Validated"
                            : doc.validationStatus === "MANUAL_CONFIRM"
                              ? "Confirmed"
                              : doc.validationStatus === "FAIL"
                                ? "Needs fix"
                                : "Review needed"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}/download?token=${token}`}
                      download
                    >
                      <Button variant="outline" size="sm" data-testid={`button-download-doc-${doc.id}`}>
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(packet.licenseNumberFormatted ||
          packet.dwsUiNumber ||
          packet.taxWithholdingWth ||
          packet.entityNumber) && (
          <Card className="border-card-border">
            <CardContent className="p-5 space-y-1">
              <h3 className="font-semibold mb-2">Copy/Paste Kit</h3>
              {packet.licenseNumberFormatted && (
                <CopyField
                  label="License Number"
                  value={packet.licenseNumberFormatted}
                />
              )}
              {packet.dwsUiNumber && (
                <CopyField label="DWS UI Number" value={packet.dwsUiNumber} />
              )}
              {packet.taxWithholdingWth && (
                <CopyField
                  label="Tax Withholding ID"
                  value={packet.taxWithholdingWth}
                />
              )}
              {packet.entityNumber && (
                <CopyField
                  label="Entity Number"
                  value={packet.entityNumber}
                />
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-card-border">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Final Steps</h3>
            <ol className="space-y-3 text-sm">
              {[
                "Log in to MyLicenseOne with your UtahID",
                "Verify your license is linked (use registration code if needed)",
                "Upload your COI and Workers Comp certificate/waiver",
                "Answer mandatory disclosure questions",
                "Pay the $128 renewal fee",
                "Submit your renewal application",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-4 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center text-xs text-muted-foreground">
          This link expires 24 hours after creation. Renewal Ready is not
          affiliated with DOPL.
        </div>
      </footer>
    </div>
  );
}
