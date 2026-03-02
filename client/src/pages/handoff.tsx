import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Handoff() {
  const [, params] = useRoute("/handoff/:token");
  const token = params?.token || "";
  const { data } = useQuery<any>({ queryKey: ["/api/handoff", token], enabled: !!token });

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{data.packet.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Shared by {data.user?.name}</p>
          <p>Readiness score: <strong>{data.packet.readiness?.overallScore ?? 0}%</strong></p>
          <ul className="list-disc pl-5 text-sm">
            {(data.packet.readiness?.itemStatus || []).map((s: any) => <li key={s.key}>{s.label}: {s.statusType}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
