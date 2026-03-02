import { AppShell } from "@/components/layout/app-shell";
import { useFrameworks } from "@/lib/readiness-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Frameworks() {
  const { data: frameworks = [] } = useFrameworks();
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold mb-6">Frameworks</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {frameworks.map((f) => (
          <Card key={f.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">{f.name}<Badge>{f.category}</Badge></CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.description || "No description"}</CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
