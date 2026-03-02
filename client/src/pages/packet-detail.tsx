import { useMemo } from "react";
import { useRoute } from "wouter";
import { AppShell } from "@/components/layout/app-shell";
import { usePacket, useUpdatePacketFields, useUploadChecklistDoc } from "@/lib/readiness-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function PacketDetail() {
  const [, params] = useRoute("/packets/:id");
  const packetId = params?.id || "";
  const { data } = usePacket(packetId);
  const updateFields = useUpdatePacketFields(packetId);
  const uploadDoc = useUploadChecklistDoc(packetId);

  const fields = useMemo(() => data?.packetFieldsJson || {}, [data]);
  const items = data?.checklist || [];
  const score = data?.readiness?.overallScore || 0;

  const onFieldChange = (key: string, value: any) => {
    updateFields.mutate({ [key]: value });
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">{data?.title || "Packet"}</h1>
          <p className="text-muted-foreground">{data?.framework?.name}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{score}%</div>
          <div className="text-sm text-muted-foreground">Readiness</div>
        </div>
      </div>
      <Progress value={score} className="mb-6" />

      <div className="space-y-3">
        {items.map((item: any) => {
          const status = data?.readiness?.itemStatus?.find((s: any) => s.key === item.key);
          return (
            <Card key={item.id} className="hover:shadow-sm transition-shadow">
              <CardHeader><CardTitle className="text-base flex items-center justify-between">{item.label}<Badge variant="secondary">{status?.statusType || "MISSING"}</Badge></CardTitle></CardHeader>
              <CardContent>
                {item.inputType === "BOOLEAN" && (
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!fields[item.key]} onCheckedChange={(v) => onFieldChange(item.key, !!v)} /> Mark complete</label>
                )}
                {item.inputType === "TEXT" && (
                  <Input defaultValue={fields[item.key] || ""} onBlur={(e) => onFieldChange(item.key, e.target.value)} placeholder="Add details" />
                )}
                {item.inputType === "NUMBER" && (
                  <Input type="number" defaultValue={fields[item.key] || ""} onBlur={(e) => onFieldChange(item.key, e.target.value ? Number(e.target.value) : null)} />
                )}
                {item.inputType === "SELECT" && (
                  <select className="w-full border rounded-md p-2" defaultValue={fields[item.key] || ""} onChange={(e) => onFieldChange(item.key, e.target.value)}>
                    <option value="">Select</option>
                    {((item.configJson?.options as string[]) || []).map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                )}
                {item.inputType === "FILE" && (
                  <input type="file" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadDoc.mutate({ file, checklistItemTemplateId: item.id });
                  }} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
