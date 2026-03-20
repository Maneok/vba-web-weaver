import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Home, User, KeyRound, UserCircle, Layers,
  Briefcase, Users, Heart, Network, Rocket, Building,
  CheckCircle2, Sparkles, Info,
} from "lucide-react";
import {
  CLIENT_TYPES, CLIENT_TYPE_CATEGORIES, getClientTypeConfig, getMissionTypeConfig,
  type ClientTypeConfig,
} from "@/lib/lettreMissionTypes";

interface Props {
  value: string;
  onValueChange: (clientTypeId: string) => void;
  recommendedType?: string;
  alternatives?: string[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'building-2': Building2, 'home': Home, 'user': User,
  'key-round': KeyRound, 'user-circle': UserCircle, 'layers': Layers,
  'briefcase': Briefcase, 'users': Users, 'heart-handshake': Heart,
  'network': Network, 'rocket': Rocket, 'building': Building,
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; activeBg: string; activeBorder: string }> = {
  blue:   { bg: 'bg-blue-50/50 dark:bg-blue-500/[0.04]',   border: 'border-blue-100 dark:border-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',     activeBg: 'bg-blue-50 dark:bg-blue-500/[0.08]',   activeBorder: 'border-blue-300 dark:border-blue-500/30' },
  purple: { bg: 'bg-purple-50/50 dark:bg-purple-500/[0.04]', border: 'border-purple-100 dark:border-purple-500/10', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300', activeBg: 'bg-purple-50 dark:bg-purple-500/[0.08]', activeBorder: 'border-purple-300 dark:border-purple-500/30' },
  teal:   { bg: 'bg-teal-50/50 dark:bg-teal-500/[0.04]',   border: 'border-teal-100 dark:border-teal-500/10',   text: 'text-teal-600 dark:text-teal-400',   badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',     activeBg: 'bg-teal-50 dark:bg-teal-500/[0.08]',   activeBorder: 'border-teal-300 dark:border-teal-500/30' },
  amber:  { bg: 'bg-amber-50/50 dark:bg-amber-500/[0.04]',  border: 'border-amber-100 dark:border-amber-500/10',  text: 'text-amber-600 dark:text-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',  activeBg: 'bg-amber-50 dark:bg-amber-500/[0.08]',  activeBorder: 'border-amber-300 dark:border-amber-500/30' },
  pink:   { bg: 'bg-pink-50/50 dark:bg-pink-500/[0.04]',   border: 'border-pink-100 dark:border-pink-500/10',   text: 'text-pink-600 dark:text-pink-400',   badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',     activeBg: 'bg-pink-50 dark:bg-pink-500/[0.08]',   activeBorder: 'border-pink-300 dark:border-pink-500/30' },
  gray:   { bg: 'bg-gray-50/50 dark:bg-white/[0.02]',      border: 'border-gray-100 dark:border-white/[0.06]',  text: 'text-gray-600 dark:text-gray-400',   badge: 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-300',    activeBg: 'bg-gray-50 dark:bg-white/[0.04]',      activeBorder: 'border-gray-300 dark:border-white/[0.15]' },
};

export default function ClientTypeSelector({ value, onValueChange, recommendedType, alternatives = [] }: Props) {
  const selectedConfig = useMemo(() => (value ? getClientTypeConfig(value) : null), [value]);
  const missionConfig = useMemo(() => (selectedConfig ? getMissionTypeConfig(selectedConfig.defaultMissionType) : null), [selectedConfig]);

  return (
    <div className="space-y-4">
      {/* Category grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {CLIENT_TYPE_CATEGORIES.map((cat) => {
          const colors = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.gray;
          const CatIcon = CATEGORY_ICONS[cat.icon] || Layers;
          const hasSel = cat.types.includes(value);

          return (
            <div
              key={cat.category}
              className={`rounded-xl border p-3 transition-all duration-200 ${
                hasSel ? `${colors.activeBg} ${colors.activeBorder} border-l-4` : `${colors.bg} ${colors.border}`
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CatIcon className={`w-4 h-4 ${colors.text}`} />
                <p className={`text-xs font-semibold ${colors.text}`}>{cat.label}</p>
              </div>
              <div className="space-y-1">
                {cat.types.map((tId) => {
                  const config = CLIENT_TYPES[tId];
                  if (!config) return null;
                  const active = value === tId;
                  const isRecommended = recommendedType === tId;
                  const isAlternative = alternatives.includes(tId);

                  return (
                    <button
                      key={tId}
                      onClick={() => onValueChange(tId)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all duration-150 ${
                        active
                          ? 'wizard-select-active'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          active ? "bg-gradient-to-r from-blue-400 to-indigo-500" : "bg-gray-300 dark:bg-gray-600"
                        }`} />
                        <span className={`text-sm truncate ${active ? `font-medium ${colors.text}` : "text-slate-600 dark:text-slate-400"}`}>
                          {config.shortLabel}
                        </span>
                        {isRecommended && (
                          <Badge className="text-[8px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-0 gap-0.5 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" /> Recommande
                          </Badge>
                        )}
                        {isAlternative && !isRecommended && (
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 shrink-0">Alt.</Badge>
                        )}
                      </div>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info banner for selected type */}
      {selectedConfig && missionConfig && (
        <div className="wizard-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedConfig.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{selectedConfig.description}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge className={`text-[10px] ${CATEGORY_COLORS[selectedConfig.categoryColor]?.badge || ''}`}>
                  {missionConfig.normeRef}
                </Badge>
                {selectedConfig.regimeFiscal && (
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedConfig.regimeFiscal === 'IS' ? 'Impot sur les societes' :
                     selectedConfig.regimeFiscal === 'IR' ? 'Impot sur le revenu' :
                     selectedConfig.regimeFiscal === 'micro' ? 'Regime micro' :
                     selectedConfig.regimeFiscal === 'bnc' ? 'BNC' : ''}
                  </Badge>
                )}
                {selectedConfig.defaultModeComptable && (
                  <Badge variant="outline" className="text-[10px]">
                    Mode : {selectedConfig.defaultModeComptable}
                  </Badge>
                )}
                {selectedConfig.hasCAC && (
                  <Badge className="text-[10px] bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                    CAC possible
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                {selectedConfig.defaultMissions.comptabilite && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.04]">Comptabilite</span>}
                {selectedConfig.defaultMissions.fiscal && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.04]">Fiscal</span>}
                {selectedConfig.defaultMissions.social && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.04]">Social</span>}
                {selectedConfig.defaultMissions.juridique && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.04]">Juridique</span>}
                {selectedConfig.defaultMissions.conseil && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.04]">Conseil</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
