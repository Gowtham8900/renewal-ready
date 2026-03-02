import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  FileText,
  LogOut,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RenewalPacket } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("2025 Contractor Renewal");
  const [renewalYear, setRenewalYear] = useState("2025");

  const { data: packets, isLoading } = useQuery<RenewalPacket[]>({
    queryKey: ["/api/packets"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/packets", {
        title,
        renewalYear,
        licenseType: "Contractor",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/packets"] });
      setOpen(false);
      navigate(`/packets/${data.id}`);
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold">Renewal Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.name}
            </span>
            {user?.isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="link-admin">
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
              My Renewal Packets
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage your contractor license renewal packets
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-packet">
                <Plus className="mr-2 h-4 w-4" />
                New Packet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Renewal Packet</DialogTitle>
                <DialogDescription>Set up a new renewal packet for your contractor license</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Packet Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., 2025 Contractor Renewal"
                    required
                    data-testid="input-packet-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Renewal Cycle Year</Label>
                  <Input
                    value={renewalYear}
                    onChange={(e) => setRenewalYear(e.target.value)}
                    placeholder="2025"
                    data-testid="input-renewal-year"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-create-packet"
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Packet
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : packets && packets.length > 0 ? (
          <div className="space-y-3">
            {packets.map((packet) => (
              <Link key={packet.id} href={`/packets/${packet.id}`}>
                <Card
                  className="border-card-border hover-elevate cursor-pointer"
                  data-testid={`card-packet-${packet.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="font-medium truncate"
                            data-testid={`text-packet-title-${packet.id}`}
                          >
                            {packet.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {packet.licenseType} &middot; {packet.renewalYear || "No year set"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-card-border border-dashed">
            <CardContent className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-medium mb-1">No packets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first renewal packet to get started
              </p>
              <Button onClick={() => setOpen(true)} data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                Create Packet
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
