import { useState, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  ArrowLeft,
  Upload,
  FileText,
  Check,
  X,
  AlertTriangle,
  Copy,
  Monitor,
  ExternalLink,
  Loader2,
  Trash2,
  HelpCircle,
  CheckCircle2,
  Circle,
  Clock,
  Award,
  CloudUpload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  RenewalPacket,
  Document as DocType,
  WorkersCompPath,
} from "@shared/schema";

type PacketWithReadiness = RenewalPacket & {
  documents: DocType[];
  readiness: {
    score: number;
    items: Record<string, { complete: boolean; weight: number }>;
  };
};

function StatusIcon({ status }: { status: string }) {
  if (status === "complete")
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "in-progress")
    return <Clock className="h-5 w-5 text-amber-500" />;
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast({ title: `${label} copied` });
      }}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <Copy className="mr-1 h-3 w-3" />
      Copy
    </Button>
  );
}

export default function PacketDetail() {
  const [, params] = useRoute("/packets/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [handoffDialog, setHandoffDialog] = useState(false);
  const [handoffLink, setHandoffLink] = useState("");
  const [coiEmailDialog, setCoiEmailDialog] = useState(false);

  const packetId = params?.id;

  const { data: packet, isLoading } = useQuery<PacketWithReadiness>({
    queryKey: ["/api/packets", packetId],
    enabled: !!packetId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<RenewalPacket>) => {
      const res = await apiRequest("PATCH", `/api/packets/${packetId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/packets", packetId],
      });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/packets/${packetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packets"] });
      navigate("/dashboard");
    },
  });

  const confirmDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("PATCH", `/api/documents/${docId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/packets", packetId],
      });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/packets", packetId],
      });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/packets/${packetId}/handoff`);
      return res.json();
    },
    onSuccess: (data) => {
      const base = window.location.origin;
      setHandoffLink(`${base}/handoff/${data.token}`);
      setHandoffDialog(true);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10MB",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);

      const res = await fetch(`/api/packets/${packetId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      const doc = await res.json();
      queryClient.invalidateQueries({
        queryKey: ["/api/packets", packetId],
      });
      toast({
        title: "Document uploaded",
        description:
          doc.validationStatus === "PASS"
            ? "Validation passed!"
            : doc.validationStatus === "FAIL"
              ? "Validation issues found. See details below."
              : "Uploaded successfully. Manual confirmation may be needed.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err.message,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (type: string) => {
    setUploadType(type);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!packet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Packet not found</p>
      </div>
    );
  }

  const score = packet.readiness?.score ?? 0;
  const items = packet.readiness?.items ?? {};
  const docs = packet.documents ?? [];
  const coiDoc = docs.find((d) => d.type === "COI");
  const wcCertDoc = docs.find((d) => d.type === "WORKERS_COMP_CERT");
  const wcWaiverDoc = docs.find((d) => d.type === "WORKERS_COMP_WAIVER");
  const ceProofDoc = docs.find((d) => d.type === "CE_PROOF");
  const peoDoc = docs.find((d) => d.type === "PEO_CONTRACT");

  const getItemStatus = (key: string) => {
    if (items[key]?.complete) return "complete";
    if (key === "utahId" && packet.hasUtahId) return "complete";
    if (key === "liabilityCoi" && coiDoc && coiDoc.validationStatus !== "PASS" && coiDoc.validationStatus !== "MANUAL_CONFIRM")
      return "in-progress";
    if (key === "liabilityCoi" && coiDoc) return items[key]?.complete ? "complete" : "in-progress";
    return "not-started";
  };

  const scoreBadgeColor =
    score >= 95
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 80
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : score >= 40
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  const isReadyToRenew = score >= 95;

  const handleDropForType = (file: File, docType: string) => {
    if (file.type !== "application/pdf") {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Only PDF files are accepted for this document.",
      });
      return;
    }
    setUploadType(docType);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        accept={
          ["COI", "WORKERS_COMP_CERT", "WORKERS_COMP_WAIVER"].includes(
            uploadType,
          )
            ? ".pdf"
            : ".pdf,.png,.jpg,.jpeg"
        }
      />

      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1
                className="font-semibold truncate text-sm"
                data-testid="text-packet-title"
              >
                {packet.title}
              </h1>
            </div>
          </div>
          <div className={`text-sm font-bold px-3 py-1 rounded-full ${scoreBadgeColor}`} data-testid="text-readiness-score">
            {score}%
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <Card className={`border-card-border ${isReadyToRenew ? "ring-2 ring-emerald-500/50" : ""}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Readiness Score</span>
              <span className="text-2xl font-bold" data-testid="text-score-value">
                {score}/100
              </span>
            </div>
            <Progress value={score} className="h-3" data-testid="progress-readiness" />
            {isReadyToRenew ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2" data-testid="badge-ready-to-renew">
                <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Ready to Renew</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                    All requirements met. Generate a desktop handoff link to complete your renewal on MyLicenseOne.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Complete all checklist items to reach 95% and unlock the "Ready to Renew" badge
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handoffMutation.mutate()}
            disabled={handoffMutation.isPending}
            data-testid="button-desktop-handoff"
          >
            {handoffMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Monitor className="mr-2 h-4 w-4" />
            )}
            Start on Desktop
          </Button>
        </div>

        <Accordion type="multiple" defaultValue={["checklist"]} className="space-y-3">
          <AccordionItem value="checklist" className="border rounded-md border-card-border">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium">
              Renewal Checklist
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              {/* 1. UtahID */}
              <ChecklistCard
                title="UtahID Ready"
                weight={10}
                status={getItemStatus("utahId")}
                description="Confirm you have a UtahID account."
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">I have a UtahID</Label>
                  <Switch
                    checked={packet.hasUtahId}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ hasUtahId: v })
                    }
                    data-testid="switch-utah-id"
                  />
                </div>
                <a
                  href="https://idhelp.utah.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 mt-1"
                  data-testid="link-utahid-help"
                >
                  UtahID Help <ExternalLink className="h-3 w-3" />
                </a>
              </ChecklistCard>

              {/* 2. MyLicenseOne */}
              <ChecklistCard
                title="MyLicenseOne Linked"
                weight={15}
                status={getItemStatus("myLicenseLinked")}
                description="Confirm your license is linked in MyLicenseOne."
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">License is linked</Label>
                  <Switch
                    checked={packet.isMyLicenseLinked}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ isMyLicenseLinked: v })
                    }
                    data-testid="switch-license-linked"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You'll need your registration code. Note: the license number
                  includes a dash before the last 4 digits.
                </p>
                <a
                  href="https://utahdoc.mylicenseone.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 mt-1"
                  data-testid="link-mylicenseone"
                >
                  Open MyLicenseOne <ExternalLink className="h-3 w-3" />
                </a>
              </ChecklistCard>

              {/* 3. Continuing Education */}
              <ChecklistCard
                title="Continuing Education Verified"
                weight={10}
                status={getItemStatus("ce")}
                description="Enter your CE hours (min 6 total, min 3 live)."
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Total Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={packet.ceTotalHours ?? ""}
                      onChange={(e) =>
                        updateMutation.mutate({
                          ceTotalHours: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="6"
                      data-testid="input-ce-total"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Live Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={packet.ceLiveHours ?? ""}
                      onChange={(e) =>
                        updateMutation.mutate({
                          ceLiveHours: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="3"
                      data-testid="input-ce-live"
                    />
                  </div>
                </div>
                {packet.ceTotalHours !== null &&
                  packet.ceTotalHours !== undefined &&
                  packet.ceTotalHours < 6 && (
                    <div className="bg-destructive/10 rounded-md p-2 mt-1 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-destructive">
                        Minimum 6 total hours required. You have {packet.ceTotalHours}. Contact your CE provider for additional credits.
                      </p>
                    </div>
                  )}
                {packet.ceLiveHours !== null &&
                  packet.ceLiveHours !== undefined &&
                  packet.ceLiveHours < 3 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2 mt-1 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Minimum 3 live hours required. You have {packet.ceLiveHours}. Online-only hours may not fully qualify.
                      </p>
                    </div>
                  )}
                <div className="mt-2">
                  {ceProofDoc ? (
                    <DocBadge doc={ceProofDoc} onDelete={deleteDocMutation.mutate} />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerUpload("CE_PROOF")}
                      data-testid="button-upload-ce"
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Upload CE Proof (optional)
                    </Button>
                  )}
                </div>
              </ChecklistCard>

              {/* 4. Business Entity */}
              <ChecklistCard
                title="Business Entity Renewed"
                weight={10}
                status={getItemStatus("entity")}
                description="Confirm your business entity registration is current."
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Entity is renewed</Label>
                  <Switch
                    checked={packet.entityRenewed}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ entityRenewed: v })
                    }
                    data-testid="switch-entity-renewed"
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">Entity Number (optional)</Label>
                  <Input
                    value={packet.entityNumber ?? ""}
                    onChange={(e) =>
                      updateMutation.mutate({ entityNumber: e.target.value })
                    }
                    placeholder="Entity number"
                    data-testid="input-entity-number"
                  />
                </div>
                <a
                  href="https://businessregistration.utah.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 mt-1"
                  data-testid="link-business-reg"
                >
                  Business Registration <ExternalLink className="h-3 w-3" />
                </a>
              </ChecklistCard>

              {/* 5. Liability Insurance COI */}
              <ChecklistCard
                title="Liability Insurance COI"
                weight={20}
                status={getItemStatus("liabilityCoi")}
                description="Upload your Certificate of Insurance (PDF). Must list DOPL as certificate holder."
              >
                {coiDoc ? (
                  <div className="space-y-2">
                    <DocBadge
                      doc={coiDoc}
                      onDelete={deleteDocMutation.mutate}
                      onConfirm={
                        coiDoc.validationStatus === "UNKNOWN" ||
                        coiDoc.validationStatus === "FAIL"
                          ? () => confirmDocMutation.mutate(coiDoc.id)
                          : undefined
                      }
                    />
                    {coiDoc.validationStatus === "FAIL" && (
                      <div className="bg-destructive/10 rounded-md p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-destructive">
                              Needs Fix
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {coiDoc.validationNotes}
                            </p>
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded p-2 mt-1">
                          <p className="text-xs font-medium mb-1">How to fix:</p>
                          <p className="text-xs text-muted-foreground">
                            Contact your insurance agent and ask them to list DOPL at 160 E 300 S, Salt Lake City, UT 84111 as the certificate holder.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCoiEmailDialog(true)}
                          data-testid="button-coi-fix"
                        >
                          Get email template to fix
                        </Button>
                      </div>
                    )}
                    {coiDoc.validationStatus === "UNKNOWN" && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {coiDoc.validationNotes ||
                            "Could not read text from PDF."}
                        </p>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            onCheckedChange={() =>
                              confirmDocMutation.mutate(coiDoc.id)
                            }
                            data-testid="checkbox-coi-confirm"
                          />
                          <span className="text-xs">
                            I confirm this document lists DOPL at 160 E 300 S,
                            Salt Lake City, UT 84111
                          </span>
                        </div>
                      </div>
                    )}
                    {coiDoc.validationStatus === "PASS" && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          COI validated — DOPL address confirmed on certificate.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <DropZone
                    docType="COI"
                    label="Drop COI PDF here or click to upload"
                    accept=".pdf"
                    uploading={uploading && uploadType === "COI"}
                    onTrigger={() => triggerUpload("COI")}
                    onFileDrop={(file) => handleDropForType(file, "COI")}
                    testId="button-upload-coi"
                  />
                )}
              </ChecklistCard>

              {/* 6. Workers Comp */}
              <ChecklistCard
                title="Workers Compensation"
                weight={25}
                status={getItemStatus("workersComp")}
                description="Choose your workers comp path and provide required documents."
              >
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Workers Comp Path</Label>
                    <Select
                      value={packet.workersCompPath}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          workersCompPath: v as WorkersCompPath,
                        })
                      }
                    >
                      <SelectTrigger data-testid="select-wc-path">
                        <SelectValue placeholder="Choose path" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Not selected</SelectItem>
                        <SelectItem value="CERTIFICATE">
                          Certificate (has employees)
                        </SelectItem>
                        <SelectItem value="WAIVER">
                          Waiver (no employees)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {packet.workersCompPath === "CERTIFICATE" && (
                    <div className="space-y-3">
                      {wcCertDoc ? (
                        <div className="space-y-2">
                          <DocBadge
                            doc={wcCertDoc}
                            onDelete={deleteDocMutation.mutate}
                            onConfirm={
                              wcCertDoc.validationStatus === "UNKNOWN" ||
                              wcCertDoc.validationStatus === "FAIL"
                                ? () => confirmDocMutation.mutate(wcCertDoc.id)
                                : undefined
                            }
                          />
                          {wcCertDoc.validationStatus === "FAIL" && (
                            <div className="bg-destructive/10 rounded-md p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-destructive">Needs Fix</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{wcCertDoc.validationNotes}</p>
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded p-2 mt-1">
                                <p className="text-xs font-medium mb-1">How to fix:</p>
                                <p className="text-xs text-muted-foreground">
                                  Your Workers Comp certificate must list DOPL at 160 E 300 S, Salt Lake City, UT 84111. Contact your insurance provider to update the certificate holder.
                                </p>
                              </div>
                            </div>
                          )}
                          {wcCertDoc.validationStatus === "PASS" && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              <p className="text-xs text-emerald-700 dark:text-emerald-300">Workers Comp certificate validated.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <DropZone
                          docType="WORKERS_COMP_CERT"
                          label="Drop Workers Comp Certificate here or click to upload"
                          accept=".pdf"
                          uploading={uploading && uploadType === "WORKERS_COMP_CERT"}
                          onTrigger={() => triggerUpload("WORKERS_COMP_CERT")}
                          onFileDrop={(file) => handleDropForType(file, "WORKERS_COMP_CERT")}
                          testId="button-upload-wc-cert"
                        />
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">DWS UI Registration #</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={packet.dwsUiNumber ?? ""}
                            onChange={(e) =>
                              updateMutation.mutate({
                                dwsUiNumber: e.target.value,
                              })
                            }
                            placeholder="DWS UI Number"
                            data-testid="input-dws-ui"
                          />
                          {packet.dwsUiNumber && (
                            <CopyButton
                              text={packet.dwsUiNumber}
                              label="DWS UI"
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">
                          Tax Withholding ID (ending -WTH)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={packet.taxWithholdingWth ?? ""}
                            onChange={(e) =>
                              updateMutation.mutate({
                                taxWithholdingWth: e.target.value,
                              })
                            }
                            placeholder="12345678-WTH"
                            data-testid="input-tax-wth"
                          />
                          {packet.taxWithholdingWth && (
                            <CopyButton
                              text={packet.taxWithholdingWth}
                              label="Tax WTH"
                            />
                          )}
                        </div>
                        {packet.taxWithholdingWth &&
                          !/WTH$/i.test(packet.taxWithholdingWth) && (
                            <p className="text-xs text-destructive">
                              Must end with -WTH
                            </p>
                          )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Using PEO instead?</Label>
                        <Switch
                          checked={packet.hasPeo}
                          onCheckedChange={(v) =>
                            updateMutation.mutate({ hasPeo: v })
                          }
                          data-testid="switch-peo"
                        />
                      </div>
                      {packet.hasPeo && (
                        <div>
                          {peoDoc ? (
                            <DocBadge
                              doc={peoDoc}
                              onDelete={deleteDocMutation.mutate}
                            />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerUpload("PEO_CONTRACT")}
                              data-testid="button-upload-peo"
                            >
                              <Upload className="mr-1 h-3 w-3" />
                              Upload PEO Contract
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {packet.workersCompPath === "WAIVER" && (
                    <div className="space-y-2">
                      {wcWaiverDoc ? (
                        <div className="space-y-2">
                          <DocBadge
                            doc={wcWaiverDoc}
                            onDelete={deleteDocMutation.mutate}
                            onConfirm={
                              wcWaiverDoc.validationStatus === "UNKNOWN" ||
                              wcWaiverDoc.validationStatus === "FAIL"
                                ? () =>
                                    confirmDocMutation.mutate(wcWaiverDoc.id)
                                : undefined
                            }
                          />
                          {wcWaiverDoc.validationStatus === "FAIL" && (
                            <div className="bg-destructive/10 rounded-md p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-destructive">Needs Fix</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{wcWaiverDoc.validationNotes}</p>
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded p-2 mt-1">
                                <p className="text-xs font-medium mb-1">How to fix:</p>
                                <p className="text-xs text-muted-foreground">
                                  Your waiver document must include "waiver" or "Utah Labor Commission" text. Contact the Utah Labor Commission to obtain the correct waiver certificate.
                                </p>
                              </div>
                            </div>
                          )}
                          {wcWaiverDoc.validationStatus === "PASS" && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              <p className="text-xs text-emerald-700 dark:text-emerald-300">Workers Comp waiver validated.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <DropZone
                          docType="WORKERS_COMP_WAIVER"
                          label="Drop Workers Comp Waiver here or click to upload"
                          accept=".pdf"
                          uploading={uploading && uploadType === "WORKERS_COMP_WAIVER"}
                          onTrigger={() => triggerUpload("WORKERS_COMP_WAIVER")}
                          onFileDrop={(file) => handleDropForType(file, "WORKERS_COMP_WAIVER")}
                          testId="button-upload-wc-waiver"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Supporting docs needed: liability COI, business check,
                        business card/ad
                      </p>
                    </div>
                  )}
                </div>
              </ChecklistCard>

              {/* 7. Mandatory Disclosure */}
              <ChecklistCard
                title="Mandatory Disclosure"
                weight={5}
                status={getItemStatus("mandatoryDisclosure")}
                description="Confirm you have reviewed and prepared your mandatory disclosure."
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Disclosure prepared</Label>
                  <Switch
                    checked={packet.mandatoryDisclosureReady}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ mandatoryDisclosureReady: v })
                    }
                    data-testid="switch-disclosure"
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    value={packet.mandatoryDisclosureNote ?? ""}
                    onChange={(e) =>
                      updateMutation.mutate({
                        mandatoryDisclosureNote: e.target.value,
                      })
                    }
                    placeholder="Any notes about disclosure..."
                    className="text-sm resize-none"
                    rows={2}
                    data-testid="textarea-disclosure-note"
                  />
                </div>
              </ChecklistCard>

              {/* 8. Fee Acknowledged */}
              <ChecklistCard
                title="Renewal Fee Acknowledged"
                weight={5}
                status={getItemStatus("feeAcknowledged")}
                description="The renewal fee is $128. Confirm you're ready to pay."
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">
                    I acknowledge the $128 renewal fee
                  </Label>
                  <Switch
                    checked={packet.feeAcknowledged}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ feeAcknowledged: v })
                    }
                    data-testid="switch-fee"
                  />
                </div>
              </ChecklistCard>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="license-info" className="border rounded-md border-card-border">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium">
              License Information
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">License Number</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={packet.licenseNumberRaw ?? ""}
                    onChange={(e) =>
                      updateMutation.mutate({
                        licenseNumberRaw: e.target.value,
                      })
                    }
                    placeholder="e.g., 12345678"
                    data-testid="input-license-number"
                  />
                  {packet.licenseNumberFormatted && (
                    <CopyButton
                      text={packet.licenseNumberFormatted}
                      label="License #"
                    />
                  )}
                </div>
                {packet.licenseNumberFormatted && (
                  <p className="text-xs text-muted-foreground">
                    Formatted: {packet.licenseNumberFormatted}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Dash is auto-inserted before last 4 digits. Avoid extra spaces.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (confirm("Delete this packet?")) deleteMutation.mutate();
            }}
            data-testid="button-delete-packet"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete Packet
          </Button>
        </div>
      </main>

      <Dialog open={handoffDialog} onOpenChange={setHandoffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desktop Handoff Link</DialogTitle>
            <DialogDescription>Open this link on your desktop to complete renewal</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open this link on your desktop computer to access your renewal
              packet. The link expires in 24 hours.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={handoffLink}
                readOnly
                className="text-xs"
                data-testid="input-handoff-link"
              />
              <CopyButton text={handoffLink} label="Link" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={coiEmailDialog} onOpenChange={setCoiEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Template for Insurance Provider</DialogTitle>
            <DialogDescription>Send this to your insurance agent to update your COI</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this email and send it to your insurance agent to get an
              updated COI.
            </p>
            <div className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap font-mono">
              {`Subject: Update Certificate Holder for DOPL Renewal

Hello,

I am renewing my Utah contractor license through the Division of Professional Licensing (DOPL). Could you please update my Certificate of Insurance (COI) to list the following as the Certificate Holder:

Division of Professional Licensing (DOPL)
160 E 300 S
Salt Lake City, UT 84111

Please send me a PDF copy of the updated certificate.

Thank you.`}
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Subject: Update Certificate Holder for DOPL Renewal\n\nHello,\n\nI am renewing my Utah contractor license through the Division of Professional Licensing (DOPL). Could you please update my Certificate of Insurance (COI) to list the following as the Certificate Holder:\n\nDivision of Professional Licensing (DOPL)\n160 E 300 S\nSalt Lake City, UT 84111\n\nPlease send me a PDF copy of the updated certificate.\n\nThank you.`,
                );
                toast({ title: "Email template copied" });
              }}
              data-testid="button-copy-email-template"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Email Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistCard({
  title,
  weight,
  status,
  description,
  children,
}: {
  title: string;
  weight: number;
  status: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-card-border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <StatusIcon status={status} />
          <div>
            <h4 className="text-sm font-medium">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {weight} pts
        </Badge>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function DocBadge({
  doc,
  onDelete,
  onConfirm,
}: {
  doc: DocType;
  onDelete: (id: number) => void;
  onConfirm?: () => void;
}) {
  const statusColor =
    doc.validationStatus === "PASS"
      ? "text-emerald-600 dark:text-emerald-400"
      : doc.validationStatus === "FAIL"
        ? "text-destructive"
        : doc.validationStatus === "MANUAL_CONFIRM"
          ? "text-primary"
          : "text-amber-500";

  return (
    <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-md p-2">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{doc.originalName}</p>
          <p className={`text-xs ${statusColor}`}>
            {doc.validationStatus === "PASS"
              ? "Validated"
              : doc.validationStatus === "FAIL"
                ? "Needs fix"
                : doc.validationStatus === "MANUAL_CONFIRM"
                  ? "Manually confirmed"
                  : "Needs review"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onConfirm && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onConfirm}
            data-testid={`button-confirm-doc-${doc.id}`}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(doc.id)}
          data-testid={`button-delete-doc-${doc.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function DropZone({
  docType,
  label,
  accept,
  uploading,
  onTrigger,
  onFileDrop,
  testId,
}: {
  docType: string;
  label: string;
  accept: string;
  uploading: boolean;
  onTrigger: () => void;
  onFileDrop: (file: File) => void;
  testId: string;
}) {
  const [active, setActive] = useState(false);

  return (
    <div
      className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
        active
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
      }`}
      onClick={onTrigger}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileDrop(file);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      data-testid={testId}
    >
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      ) : (
        <CloudUpload className="h-6 w-6 mx-auto text-muted-foreground/60" />
      )}
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">PDF only, max 10MB</p>
    </div>
  );
}
