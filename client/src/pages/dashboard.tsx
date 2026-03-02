import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useFrameworks } from "@/lib/readiness-hooks";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: packets = [] } = useQuery<any[]>({ queryKey: ["/api/packets"] });
  const { data: frameworks = [] } = useFrameworks();
  const [open, setOpen] = useState(false);
  const [frameworkId, setFrameworkId] = useState("");
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/packets", { frameworkId, title })).json(),
    onSuccess: (packet) => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/packets"] });
      navigate(`/packets/${packet.id}`);
    },
  });

  const filtered = packets.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Readiness Dashboard</h1>
          <p className="text-muted-foreground">Track progress across frameworks.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Create Packet</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Readiness Packet</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <select className="w-full border rounded-md p-2" value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)}>
                <option value="">Select framework</option>
                {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <Input placeholder="Packet name (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button className="w-full" disabled={!frameworkId} onClick={() => createMutation.mutate()}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search packets..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((packet) => (
          <Card key={packet.id} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{packet.title}</span>
                <Badge variant="secondary">{packet.frameworkId ? "Framework" : "Legacy"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={packet.readiness?.overallScore || 0} />
              <div className="text-sm text-muted-foreground">Updated {new Date(packet.updatedAt).toLocaleDateString()}</div>
              <div className="flex gap-2">
                <Link href={`/packets/${packet.id}`}><Button size="sm">Continue</Button></Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
