import { Check, X, Minus } from "lucide-react";
import { useInView } from "./useInView";

type CellValue = "yes" | "no" | "partial" | string;

interface Row {
  feature: string;
  grimy: CellValue;
  kanta: CellValue;
  excel: CellValue;
}

const rows: Row[] = [
  { feature: "Screening automatique (9 APIs)", grimy: "yes", kanta: "partial", excel: "no" },
  { feature: "Documents INPI (statuts, comptes PDF)", grimy: "yes", kanta: "no", excel: "no" },
  { feature: "Scoring multi-critères NPLAB", grimy: "yes", kanta: "yes", excel: "Manuel" },
  { feature: "Lettre de mission auto", grimy: "yes", kanta: "yes", excel: "no" },
  { feature: "OCR Cloud Vision (CNI/RIB)", grimy: "yes", kanta: "no", excel: "no" },
  { feature: "Gel des avoirs DG Trésor", grimy: "yes", kanta: "no", excel: "no" },
  { feature: "Gouvernance complète", grimy: "yes", kanta: "partial", excel: "no" },
  { feature: "Mode contrôleur CROEC", grimy: "yes", kanta: "yes", excel: "no" },
  { feature: "Prix transparent", grimy: "29€/mois", kanta: "Sur devis", excel: "Gratuit" },
  { feature: "Mise en conformité", grimy: "10 min", kanta: "30 jours", excel: "∞" },
];

function CellContent({ value }: { value: CellValue }) {
  if (value === "yes") return <Check className="text-green-400 mx-auto" size={18} />;
  if (value === "no") return <X className="text-red-400/60 mx-auto" size={18} />;
  if (value === "partial") return <span className="text-amber-400 text-sm">Partiel</span>;
  return <span className="text-white/80 text-sm">{value}</span>;
}

export default function ComparisonSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-16 transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-serif">
            GRIMY vs les alternatives
          </h2>
        </div>

        {/* Desktop table */}
        <div
          className={`hidden md:block transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-4 px-6 text-white/40 text-sm font-medium">Fonctionnalité</th>
                  <th className="py-4 px-6 text-center bg-blue-500/10 border-x border-blue-500/20">
                    <span className="text-blue-400 font-bold text-sm">GRIMY</span>
                  </th>
                  <th className="py-4 px-6 text-center text-white/40 text-sm font-medium">Kanta</th>
                  <th className="py-4 px-6 text-center text-white/40 text-sm font-medium">Excel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-3 px-6 text-white/70 text-sm">{r.feature}</td>
                    <td className="py-3 px-6 text-center bg-blue-500/5 border-x border-blue-500/10">
                      <CellContent value={r.grimy} />
                    </td>
                    <td className="py-3 px-6 text-center">
                      <CellContent value={r.kanta} />
                    </td>
                    <td className="py-3 px-6 text-center">
                      <CellContent value={r.excel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {rows.map((r, i) => (
            <div
              key={r.feature}
              className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: inView ? `${i * 50}ms` : "0ms" }}
            >
              <div className="text-white/80 text-sm font-medium mb-3">{r.feature}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-blue-400 mb-1">GRIMY</div>
                  <CellContent value={r.grimy} />
                </div>
                <div>
                  <div className="text-[10px] text-white/40 mb-1">Kanta</div>
                  <CellContent value={r.kanta} />
                </div>
                <div>
                  <div className="text-[10px] text-white/40 mb-1">Excel</div>
                  <CellContent value={r.excel} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
