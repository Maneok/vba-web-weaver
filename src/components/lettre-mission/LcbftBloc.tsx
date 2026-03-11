import { Lock } from "lucide-react";
import type { VigilanceLevel, Client } from "../../lib/types";
import { LCBFT_TEMPLATES } from "../../lib/lcbftTemplates";
import KycChecklist from "./KycChecklist";
import ScoreResume from "./ScoreResume";

interface LcbftBlocProps {
  vigilanceLevel: VigilanceLevel;
  client: Client;
}

export default function LcbftBloc({ vigilanceLevel, client }: LcbftBlocProps) {
  const template = LCBFT_TEMPLATES[vigilanceLevel];

  if (!template) {
    return (
      <div className="border rounded p-4 text-sm text-gray-500">
        Niveau de vigilance inconnu : {vigilanceLevel}
      </div>
    );
  }

  return (
    <div className="border-l-4 border-[#0f172a] bg-[#f8fafc] rounded-r-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center gap-3">
        <Lock className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{template.titre}</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Corps du texte */}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {template.corps.split(/(art\.\s+L\.\d+[-\d]*(?:\s+(?:et|à)\s+L\.\d+[-\d]*)*\s+(?:du\s+)?CMF|art\.\s+\d+[-\d]*\s+du\s+Code\s+pénal)/gi).map(
            (part, i) => {
              if (
                /^art\.\s+(L\.\d+|[\d])/i.test(part)
              ) {
                return (
                  <strong key={i} className="text-[#0f172a]">
                    {part}
                  </strong>
                );
              }
              return <span key={i}>{part}</span>;
            }
          )}
        </div>

        {/* Obligations client */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Obligations du client
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {template.obligations_client.map((obligation, i) => (
              <li key={i}>{obligation}</li>
            ))}
          </ul>
        </div>

        {/* Conséquences */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Conséquences en cas de non-conformité
          </h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {template.consequences_non_conformite.map((consequence, i) => (
              <li key={i}>{consequence}</li>
            ))}
          </ul>
        </div>

        {/* Fréquence de revue */}
        <div className="bg-white border rounded p-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Fréquence de revue</span>
          <span className="text-sm font-semibold text-[#0f172a]">
            {template.frequence_revue}
          </span>
        </div>

        {/* KYC Checklist */}
        <div className="bg-white border rounded p-4">
          <KycChecklist vigilanceLevel={vigilanceLevel} client={client} />
        </div>

        {/* Score Résumé */}
        <div className="bg-white border rounded p-4">
          <ScoreResume client={client} />
        </div>
      </div>
    </div>
  );
}
