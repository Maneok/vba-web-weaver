import { useEffect } from "react";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import SocialProofBar from "@/components/landing/SocialProofBar";
import PainSection from "@/components/landing/PainSection";
import BentoFeatures from "@/components/landing/BentoFeatures";
import HowItWorks from "@/components/landing/HowItWorks";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import PricingSection from "@/components/landing/PricingSection";
import SecuritySection from "@/components/landing/SecuritySection";
import FAQSection from "@/components/landing/FAQSection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  useEffect(() => {
    document.title =
      "GRIMY — Conformité LCB-FT automatisée pour experts-comptables";

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Automatisez votre dispositif anti-blanchiment. Screening 9 APIs, scoring NPLAB, lettre de mission, gouvernance. Essai gratuit 14 jours."
    );
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050510] to-[#0a0a2e] text-white antialiased">
      <LandingNav />
      <HeroSection />
      <SocialProofBar />
      <PainSection />
      <BentoFeatures />
      <HowItWorks />
      <TestimonialsSection />
      <ComparisonSection />
      <PricingSection />
      <SecuritySection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
