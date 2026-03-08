import { useState, useEffect } from "react";
import { ClipboardCheck, FileDown, RefreshCw, Plus, Eye, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { controlesService } from "@/lib/supabaseService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VigilanceBadge, ScoreGauge } from "@/components/RiskBadges";
import { toast } from "sonner";
import type { ControleQualite } from "@/lib/types";
import { generateRapportControle } from "@/lib/generateControlePdf";

type ResultatGlobal = "CONFORME" | "NON CONFORME MINEUR" | "NON CONFORME MAJEUR" | "CONFORME AVEC RESERVES";

const RESULTAT_OPTIONS: ResultatGlobal[] = [
  "CONFORME",
  "NON CONFORME MINEUR",
  "NON CONFORME MAJEUR",
  "CONFORME AVEC RESERVES",
];

const resultatColor: Record<ResultatGlobal, string> = {
  "CONFORME": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "NON CONFORME MINEUR": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "NON CONFORME MAJEUR": "text-red-400 bg-red-500/10 border-red-500/20",
  "CONFORME AVEC RESERVES": "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const resultatIcon: Record<ResultatGlobal, typeof CheckCircle2> = {
  "CONFORME": CheckCircle2,
  "NON CONFORME MINEUR": AlertTriangle,
  "NON CONFORME MAJEUR": XCircle,
  "CONFORME AVEC RESERVES": Info,
};

function mapDbToControle(row: Record<string, unknown>): ControleQualite {
  return {
    dateTirage: (row.date_tirage as string) || "",
    dossierAudite: (row.dossier_audite as string) || "",
    siren: (row.siren as string) || "",
    forme: (row.forme as string) || "",
    ppe: ((row.ppe as string) || "NON") as "OUI" | "NON",
    paysRisque: ((row.pays_risque as string) || "NON") as "OUI" | "NON",
    atypique: ((row.atypique as string) || "NON") as "OUI" | "NON",
    distanciel: ((row.distanciel as string) || "NON") as "OUI" | "NON",
    cash: ((row.cash as string) || "NON") as "OUI" | "NON",
    pression: ((row.pression as string) || "NON") as "OUI" | "NON",
    scoreGlobal: (row.score_global as number) || 0,
    nivVigilance: ((row.niv_vigilance as string) || "SIMPLIFIEE") as ControleQualite["nivVigilance"],
    point1: (row.point1 as string) || "",
    point2: (row.point2 as string) || "",
    point3: (row.point3 as string) || "",
    resultatGlobal: (row.resultat_global as string) || "",
    incident: (row.incident as string) || "",
    commentaire: (row.commentaire as string) || "",
  };
}

function mapControleToDb(c: ControleQualite): Record<string, unknown> {
  return {
    date_tirage: c.dateTirage,
    dossier_audite: c.dossierAudite,
    siren: c.siren,
    forme: c.forme,
    ppe: c.ppe,
    pays_risque: c.paysRisque,
    atypique: c.atypique,
    distanciel: c.distanciel,
    cash: c.cash,
    pression: c.pression,
    score_global: c.scoreGlobal,
    niv_vigilance: c.nivVigilance,
    point1: c.point1,
    point2: c.point2,
    point3: c.point3,
    resultat_global: c.resultatGlobal,
    incident: c.incident,
    commentaire: c.commentaire,
  };
}

export default function ControlePage() {
  const { clients, addLog, isOnline } = useAppState();
  const [controles, setControles] = useState<ControleQualite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<ControleQualite>({
    dateTirage: "",
    dossierAudite: "",
    siren: "",
    forme: "",
    ppe: "NON",
    paysRisque: "NON",
    atypique: "NON",
    distanciel: "NON",
    cash: "NON",
    pression: "NON",
    scoreGlobal: 0,
    nivVigilance: "SIMPLIFIEE",
    point1: "",
    point2: "",
    point3: "",
    resultatGlobal: "CONFORME",
    incident: "",
    commentaire: "",
  });

  // Load controles from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await controlesService.getAll();
        if (!cancelled) {
          setControles(rows.map((r: Record<string, unknown>) => mapDbToControle(r)));
        }
      } catch {
        toast.error("Erreur lors du chargement des controles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // New random draw: pick one random client, pre-fill form
  const handleNouveauTirage = () => {
    const valides = clients.filter((c) => c.etat === "VALIDE");
    if (valides.length === 0) {
      toast.error("Aucun client valide pour le tirage");
      return;
    }
    const randomIndex = Math.floor(Math.random() * valides.length);
    const c = valides[randomIndex];
    const today = new Date().toISOString().split("T")[0];

    setForm({
      dateTirage: today,
      dossierAudite: c.raisonSociale,
      siren: c.siren,
      forme: c.forme,
      ppe: c.ppe,
      paysRisque: c.paysRisque,
      atypique: c.atypique,
      distanciel: c.distanciel,
      cash: c.cash,
      pression: c.pression,
      scoreGlobal: c.scoreGlobal,
      nivVigilance: c.nivVigilance,
      point1: "",
      point2: "",
      point3: "",
      resultatGlobal: "CONFORME",
      incident: "",
      commentaire: "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.point1 || !form.point2 || !form.point3) {
      toast.error("Veuillez remplir les 3 points de controle");
      return;
    }
    setSaving(true);
    try {
      const dbRow = mapControleToDb(form);
      const result = await controlesService.create(dbRow);
      if (result) {
        setControles((prev) => [mapDbToControle(result), ...prev]);
        addLog({
          horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
          utilisateur: "Utilisateur",
          refClient: form.siren,
          typeAction: "CONTROLE_QUALITE",
          details: `Controle qualite: ${form.dossierAudite} — ${form.resultatGlobal}`,
        });
        toast.success("Controle enregistre");
        setShowForm(false);
      } else {
        toast.error("Erreur lors de l'enregistrement");
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    const valides = clients.filter((c) => c.etat === "VALIDE");
    if (valides.length === 0) {
      toast.error("Aucun dossier pour le rapport");
      return;
    }
    generateRapportControle(valides.slice(0, 5));
    toast.success("Rapport de controle genere (PDF)");
  };

  const detailControle = detailIndex !== null ? controles[detailIndex] : null;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1300px] mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Controle qualite</p>
          <h1 className="text-xl font-semibold text-slate-100 mt-1">
            Revue des dossiers LCB-FT
          </h1>
        </div>
        <div className="flex gap-2">
          {!isOnline && (
            <span className="text-xs text-amber-400 self-center mr-2">Hors ligne</span>
          )}
          <Button variant="outline" className="gap-1.5 border-white/[0.06]" onClick={handleExportPDF}>
            <FileDown className="w-4 h-4" /> Rapport PDF
          </Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleNouveauTirage}>
            <RefreshCw className="w-4 h-4" /> Nouveau tirage aleatoire
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total controles", value: controles.length, color: "text-blue-400" },
          { label: "Conformes", value: controles.filter((c) => c.resultatGlobal === "CONFORME").length, color: "text-emerald-400" },
          { label: "Non conformes", value: controles.filter((c) => c.resultatGlobal.startsWith("NON CONFORME")).length, color: "text-red-400" },
          { label: "Avec reserves", value: controles.filter((c) => c.resultatGlobal === "CONFORME AVEC RESERVES").length, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table of past controles */}
      <div className="animate-fade-in-up glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">Historique des controles</h3>
          <span className="text-xs text-slate-500 ml-auto">{controles.length} enregistrement{controles.length > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Chargement...</div>
        ) : controles.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun controle enregistre</p>
            <p className="text-xs text-slate-600 mt-1">Lancez un tirage aleatoire pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/[0.06]">
                  <th className="px-6 py-3 font-medium">Date tirage</th>
                  <th className="px-6 py-3 font-medium">Dossier audite</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                  <th className="px-6 py-3 font-medium">Vigilance</th>
                  <th className="px-6 py-3 font-medium">Resultat</th>
                  <th className="px-6 py-3 font-medium">Incident</th>
                  <th className="px-6 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {controles.map((c, idx) => {
                  const ResultIcon = resultatIcon[c.resultatGlobal as ResultatGlobal] || CheckCircle2;
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => setDetailIndex(idx)}
                    >
                      <td className="px-6 py-3.5 text-slate-400 font-mono text-xs">{c.dateTirage}</td>
                      <td className="px-6 py-3.5">
                        <p className="text-slate-200 font-medium">{c.dossierAudite}</p>
                        <p className="text-xs text-slate-500">{c.siren} · {c.forme}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <ScoreGauge score={c.scoreGlobal} />
                      </td>
                      <td className="px-6 py-3.5">
                        <VigilanceBadge level={c.nivVigilance} />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${resultatColor[c.resultatGlobal as ResultatGlobal] || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                          <ResultIcon className="w-3 h-3" />
                          {c.resultatGlobal}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-400 max-w-[200px] truncate">
                        {c.incident || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-3.5">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New controle form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/[0.08] text-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Plus className="w-5 h-5 text-blue-400" />
              Nouveau controle qualite
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Pre-filled client info */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Dossier tire au sort</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{form.dossierAudite}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{form.siren} · {form.forme}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreGauge score={form.scoreGlobal} />
                  <VigilanceBadge level={form.nivVigilance} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: "PPE", value: form.ppe },
                  { label: "Pays risque", value: form.paysRisque },
                  { label: "Atypique", value: form.atypique },
                  { label: "Distanciel", value: form.distanciel },
                  { label: "Cash", value: form.cash },
                  { label: "Pression", value: form.pression },
                ].map((flag) => (
                  <span
                    key={flag.label}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      flag.value === "OUI"
                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-slate-500 bg-slate-500/5 border-white/[0.06]"
                    }`}
                  >
                    {flag.label}: {flag.value}
                  </span>
                ))}
              </div>
            </div>

            {/* 3 checkpoints */}
            <div className="space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Points de controle</p>
              {[
                { key: "point1" as const, label: "1. Identite & Beneficiaires effectifs", placeholder: "Verification CNI, KBIS, RBE a jour..." },
                { key: "point2" as const, label: "2. Scoring & Niveau de vigilance", placeholder: "Coherence du score, criteres de risque..." },
                { key: "point3" as const, label: "3. Documents & Contrat", placeholder: "Lettre de mission, mandat, pieces justificatives..." },
              ].map((cp) => (
                <div key={cp.key} className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{cp.label}</label>
                  <textarea
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                    rows={2}
                    placeholder={cp.placeholder}
                    value={form[cp.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [cp.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* Resultat global */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Resultat global</label>
              <select
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                value={form.resultatGlobal}
                onChange={(e) => setForm((prev) => ({ ...prev, resultatGlobal: e.target.value }))}
              >
                {RESULTAT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Incident */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Incident declare</label>
              <input
                type="text"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="Decrire l'incident le cas echeant..."
                value={form.incident}
                onChange={(e) => setForm((prev) => ({ ...prev, incident: e.target.value }))}
              />
            </div>

            {/* Commentaire */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Commentaire</label>
              <textarea
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                rows={3}
                placeholder="Observations complementaires..."
                value={form.commentaire}
                onChange={(e) => setForm((prev) => ({ ...prev, commentaire: e.target.value }))}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/[0.06]" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={handleSave} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer le controle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailIndex !== null} onOpenChange={() => setDetailIndex(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/[0.08] text-slate-100 max-h-[90vh] overflow-y-auto">
          {detailControle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-100">
                  <Eye className="w-5 h-5 text-blue-400" />
                  Detail du controle
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Client info */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{detailControle.dossierAudite}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {detailControle.siren} · {detailControle.forme} · Tire le {detailControle.dateTirage}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreGauge score={detailControle.scoreGlobal} />
                      <VigilanceBadge level={detailControle.nivVigilance} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { label: "PPE", value: detailControle.ppe },
                      { label: "Pays risque", value: detailControle.paysRisque },
                      { label: "Atypique", value: detailControle.atypique },
                      { label: "Distanciel", value: detailControle.distanciel },
                      { label: "Cash", value: detailControle.cash },
                      { label: "Pression", value: detailControle.pression },
                    ].map((flag) => (
                      <span
                        key={flag.label}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          flag.value === "OUI"
                            ? "text-red-400 bg-red-500/10 border-red-500/20"
                            : "text-slate-500 bg-slate-500/5 border-white/[0.06]"
                        }`}
                      >
                        {flag.label}: {flag.value}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3 checkpoints */}
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Points de controle</p>
                  {[
                    { label: "1. Identite & Beneficiaires effectifs", value: detailControle.point1 },
                    { label: "2. Scoring & Niveau de vigilance", value: detailControle.point2 },
                    { label: "3. Documents & Contrat", value: detailControle.point3 },
                  ].map((cp) => (
                    <div key={cp.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-xs font-medium text-slate-400 mb-1">{cp.label}</p>
                      <p className="text-sm text-slate-200">{cp.value || <span className="text-slate-600 italic">Non renseigne</span>}</p>
                    </div>
                  ))}
                </div>

                {/* Resultat */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Resultat:</span>
                  {(() => {
                    const ResultIcon = resultatIcon[detailControle.resultatGlobal as ResultatGlobal] || CheckCircle2;
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${resultatColor[detailControle.resultatGlobal as ResultatGlobal] || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                        <ResultIcon className="w-3 h-3" />
                        {detailControle.resultatGlobal}
                      </span>
                    );
                  })()}
                </div>

                {/* Incident & Commentaire */}
                {detailControle.incident && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                    <p className="text-xs font-medium text-orange-400 mb-1">Incident declare</p>
                    <p className="text-sm text-slate-200">{detailControle.incident}</p>
                  </div>
                )}

                {detailControle.commentaire && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-xs font-medium text-slate-400 mb-1">Commentaire</p>
                    <p className="text-sm text-slate-200">{detailControle.commentaire}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
