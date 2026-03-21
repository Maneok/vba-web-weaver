import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CONDITIONS_GENERALES } from "../../lib/lettreMissionAnnexes";

export default function ConditionsGenerales() {
  const sections = CONDITIONS_GENERALES?.sections ?? [];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800/60 px-6 py-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          {CONDITIONS_GENERALES?.titre ?? "Conditions générales"}
        </h3>
        <span className="text-xs text-muted-foreground">{sections.length} articles</span>
      </div>
      <div className="p-4 max-h-[600px] overflow-y-auto">
        <Accordion type="multiple" className="space-y-0">
          {sections.map((section) => (
            <AccordionItem key={section?.numero ?? ""} value={`article-${section?.numero}`} className="border-b border-border/50 last:border-0">
              <AccordionTrigger className="py-3 hover:no-underline gap-3">
                <div className="flex items-center gap-3 text-left">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {section?.numero ?? ""}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {section?.titre ?? ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-10 pr-2">
                <div
                  className="text-sm text-muted-foreground leading-[1.6] whitespace-pre-line"
                  style={{ fontSize: "13px", textAlign: "justify" }}
                >
                  {section?.texte ?? ""}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
