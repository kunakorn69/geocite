import Link from "next/link";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroLaunchPad() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.65_0.22_250)_/_14%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,oklch(0.7_0.2_160)_/_10%,transparent_55%)]" />

      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          <Rocket className="h-3.5 w-3.5 text-primary" />
          The AI SaaS starter for builders
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Ship Your AI SaaS{" "}
          <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 bg-clip-text text-transparent dark:from-indigo-400 dark:via-sky-400 dark:to-emerald-300">
            in a Weekend
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          LaunchPad is a production-ready Next.js 15 boilerplate with auth,
          payments, AI streaming, and a polished UI already wired up — so you
          can focus on the idea, not the plumbing.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button render={<Link href="/signup" />} size="lg" className="text-base px-8">
            Start Building
          </Button>
          <Button render={<a href="#features" />} variant="outline" size="lg" className="text-base px-8">
            Explore the Stack
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Next.js 15 + TypeScript
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
            Firebase Auth & Firestore
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Stripe Subscriptions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
            Claude AI Streaming
          </span>
        </div>
      </div>
    </section>
  );
}
