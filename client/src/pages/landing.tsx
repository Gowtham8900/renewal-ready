import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import {
  Shield,
  Smartphone,
  Monitor,
  FileCheck,
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-lg font-semibold tracking-tight">
              Renewal Ready
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" data-testid="link-login">
                Log in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" data-testid="link-signup">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full">
            <FileCheck className="h-4 w-4" />
            Utah DOPL Contractor License
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Prepare your renewal
            <br />
            <span className="text-primary">on mobile</span>, finish on
            desktop
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Renewal Ready helps you gather documents, validate your COI, track
            your checklist, and generate a desktop handoff link — all before
            you ever open MyLicenseOne.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/auth/signup">
              <Button size="lg" data-testid="button-get-started">
                Start Preparing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="lg"
                data-testid="button-login-hero"
              >
                I have an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Smartphone,
                title: "Prepare on Mobile",
                desc: "Upload your COI, enter license info, and check off each renewal requirement from your phone.",
              },
              {
                icon: ClipboardCheck,
                title: "Track Readiness",
                desc: "Watch your readiness score climb to 100% as each item is completed and validated.",
              },
              {
                icon: Monitor,
                title: "Finish on Desktop",
                desc: "Generate a secure handoff link, open it on your computer, and complete renewal on MyLicenseOne.",
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="p-6 space-y-3 border-card-border"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-6">
            Important notes
          </h2>
          <div className="space-y-3">
            {[
              "Contracting licenses expire November 30 of odd-numbered years.",
              "Renewal notices are sent at least 60 days before expiration.",
              "MyLicenseOne does not support mobile renewal — use a desktop browser for final submission.",
              "This app does NOT perform the official renewal. It only helps you prepare.",
            ].map((note, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6 px-4">
        <div className="max-w-6xl mx-auto text-center text-xs text-muted-foreground">
          Renewal Ready is not affiliated with DOPL, UtahID, or MyLicenseOne.
        </div>
      </footer>
    </div>
  );
}
