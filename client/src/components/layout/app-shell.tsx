import { Link } from "wouter";
import { LayoutGrid, Layers, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between border-b bg-background/70 backdrop-blur rounded-xl sticky top-2 z-50">
        <div className="flex items-center gap-2 font-semibold"><Shield className="h-5 w-5 text-primary" /> Readiness</div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="px-3 py-1.5 rounded-md hover:bg-muted"><span className="inline-flex items-center gap-1"><LayoutGrid className="h-4 w-4"/>Dashboard</span></Link>
          <Link href="/frameworks" className="px-3 py-1.5 rounded-md hover:bg-muted"><span className="inline-flex items-center gap-1"><Layers className="h-4 w-4"/>Frameworks</span></Link>
          {user?.isAdmin && <Link href="/admin" className="px-3 py-1.5 rounded-md hover:bg-muted">Admin</Link>}
        </nav>
      </div>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
