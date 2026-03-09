import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useInView } from "./useInView";

const faqs = [
  {
    q: "GRIMY est-il conforme à la NPLAB ?",
    a: "Oui. GRIMY a été conçu pour répondre exactement aux exigences de la norme NPLAB 2020 et de la NPMQ 2025. Chaque fonctionnalité est mappée sur une obligation réglementaire.",
  },
  {
    q: "Combien de temps pour être opérationnel ?",
    a: "Créez votre compte, importez vos clients par SIREN, et GRIMY fait le reste. La plupart des cabinets sont opérationnels en moins de 10 minutes.",
  },
  {
    q: "Puis-je importer mes clients existants ?",
    a: "Oui. Import par SIREN unitaire ou en masse. GRIMY récupère automatiquement toutes les données depuis les sources officielles (INPI, INSEE).",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Absolument. Chiffrement AES-256, hébergement en Europe, conformité RGPD, accès par rôle et journal d'audit complet.",
  },
  {
    q: "Y a-t-il un engagement ?",
    a: "Non. Tous nos plans sont sans engagement. Vous pouvez annuler à tout moment depuis votre espace.",
  },
  {
    q: "Comment se passe un contrôle LAB avec GRIMY ?",
    a: "GRIMY génère un dossier de conformité complet en un clic : cartographie des risques, registre LCB-FT, historique des diligences, formations. Le mode contrôleur permet au contrôleur CROEC de naviguer en autonomie.",
  },
  {
    q: "GRIMY remplace-t-il mon logiciel comptable ?",
    a: "Non. GRIMY est complémentaire. Il couvre uniquement la conformité LCB-FT et la lettre de mission. Il ne fait pas de comptabilité, de paie ou de fiscalité.",
  },
  {
    q: "Proposez-vous un accompagnement ?",
    a: "Oui. Le plan Cabinet inclut un support prioritaire. Le plan Enterprise inclut une formation sur site et un référent dédié.",
  },
];

export default function FAQSection() {
  const { ref, inView } = useInView();

  return (
    <section id="faq" ref={ref} className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-16 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            Questions fréquentes
          </h2>
        </div>

        <div
          className={`transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 data-[state=open]:border-blue-500/20"
              >
                <AccordionTrigger className="text-white/80 text-sm hover:text-white hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-white/50 text-sm pb-4">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
