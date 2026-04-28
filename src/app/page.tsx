import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HeroLaunchPad } from "@/components/landing/hero-launchpad";
import { LogoBar } from "@/components/landing/logo-bar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Testimonials } from "@/components/landing/testimonials";
import { Stats } from "@/components/landing/stats";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  const showLaunchPad = process.env.NEXT_PUBLIC_SHOW_LAUNCHPAD_BRANDING === "true";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {showLaunchPad ? <HeroLaunchPad /> : <Hero />}
        <LogoBar />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Stats />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
