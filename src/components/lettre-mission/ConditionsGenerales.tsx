import { CONDITIONS_GENERALES } from "../../lib/lettreMissionAnnexes";

export default function ConditionsGenerales() {
  return (
    <div className="border rounded-lg bg-white">
      <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-base font-semibold">
          {CONDITIONS_GENERALES.titre}
        </h3>
      </div>
      <div className="p-6 max-h-[600px] overflow-y-auto space-y-6">
        {CONDITIONS_GENERALES.sections.map((section) => (
          <div key={section.numero}>
            <h4 className="text-sm font-bold text-gray-800 mb-2">
              Article {section.numero} — {section.titre}
            </h4>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {section.texte}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
