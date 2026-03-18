import { CONDITIONS_GENERALES } from "../../lib/lettreMissionAnnexes";

export default function ConditionsGenerales() {
  return (
    <div className="border border-slate-600 rounded-lg">
      <div className="bg-gray-800 text-slate-900 dark:text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-base font-semibold">
          {CONDITIONS_GENERALES?.titre ?? "Conditions générales"}
        </h3>
      </div>
      <div className="p-6 max-h-[600px] overflow-y-auto space-y-6">
        {(CONDITIONS_GENERALES?.sections ?? []).map((section) => (
          <div key={section?.numero ?? ""}>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              Article {section?.numero ?? ""} — {section?.titre ?? ""}
            </h4>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {section?.texte ?? ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
