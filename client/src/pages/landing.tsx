import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background flex items-center">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
        <h1 className="text-5xl font-semibold tracking-tight">Readiness for any framework</h1>
        <p className="text-lg text-muted-foreground">Build packets for compliance, licensing, governance, and operational checklists across any jurisdiction or organization.</p>
        <div className="flex justify-center gap-3">
          <Link href="/auth/signup"><Button size="lg">Get Started</Button></Link>
          <Link href="/auth/login"><Button size="lg" variant="outline">Sign In</Button></Link>
        </div>
      </div>
    </div>
  );
}
