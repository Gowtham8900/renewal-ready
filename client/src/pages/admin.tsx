import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  ArrowLeft,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type AdminStats = {
  totalPackets: number;
  totalUsers: number;
  avgReadinessScore: number;
  coiFailRate: number;
  wcFailRate: number;
  incompleteItems: Record<string, number>;
};

const checklistLabels: Record<string, string> = {
  utahId: "UtahID Ready",
  myLicenseLinked: "MyLicenseOne Linked",
  ce: "Continuing Education",
  entity: "Business Entity",
  liabilityCoi: "Liability COI",
  workersComp: "Workers Comp",
  mandatoryDisclosure: "Mandatory Disclosure",
  feeAcknowledged: "Fee Acknowledged",
};

export default function Admin() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-admin-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-semibold">Admin Dashboard</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-4">
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-users">
                      {stats.totalUsers}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-packets">
                      {stats.totalPackets}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total Packets
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-avg-readiness">
                      {stats.avgReadinessScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg Readiness
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-coi-fail-rate">
                      {stats.coiFailRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      COI Fail Rate
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-wc-fail-rate">
                      {stats.wcFailRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      WC Fail Rate
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-card-border">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Most Common Incomplete Items</h3>
                <div className="space-y-3">
                  {Object.entries(stats.incompleteItems)
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, count]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{checklistLabels[key] || key}</span>
                          <span className="text-muted-foreground font-mono">
                            {count}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats.totalPackets > 0
                              ? (count / stats.totalPackets) * 100
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
