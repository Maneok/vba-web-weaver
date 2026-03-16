import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyToken, signDocument, type SignatureCertificate } from "@/lib/lettreMissionSignature";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, AlertTriangle, Clock, Loader2,
  Shield, Download, Lock,
} from "lucide-react";

type PageState = "loading" | "error" | "already_signed" | "view" | "signed";

interface InstanceData {
  id: string;
  numero: string;
  raison_sociale: string;
  type_mission: string;
  statut: string;
  created_at: string;
  wizard_data: Record<string, unknown>;
}

export default function SignerPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [clientNom, setClientNom] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [signer, setSigner] = useState("");

  // Signature form
  const [accepted, setAccepted] = useState(false);
  const [signerNom, setSignerNom] = useState("");
  const [signerQualite, setSignerQualite] = useState("");
  const [signing, setSigning] = useState(false);
  const [certificate, setCertificate] = useState<SignatureCertificate | null>(null);
  const [certificateUrl, setCertificateUrl] = useState("");

  // Load token data
  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Aucun token de signature fourni.");
      return;
    }

    (async () => {
      const result = await verifyToken(token);

      if (result.already_signed) {
        setState("already_signed");
        setSignedAt(result.signed_at || "");
        setSigner(result.signer || "");
        return;
      }

      if (!result.valid) {
        setState("error");
        setErrorMsg(
          result.expired
            ? "Ce lien de signature a expire. Veuillez contacter votre expert-comptable pour obtenir un nouveau lien."
            : result.error || "Lien de signature invalide."
        );
        return;
      }

      setInstance(result.instance || null);
      setClientNom(result.client_nom || "");
      setSignerNom(result.client_nom || "");
      setState("view");
    })();
  }, [token]);

  const handleSign = async () => {
    if (!accepted || !signerNom.trim()) return;

    setSigning(true);
    const result = await signDocument(token, signerNom.trim(), signerQualite.trim());
    setSigning(false);

    if (result.success) {
      setState("signed");
      setSignedAt(result.signed_at || new Date().toISOString());
      setCertificate(result.certificate || null);
      setCertificateUrl(result.certificate_url || "");
    } else {
      setErrorMsg(result.error || "Erreur lors de la signature");
      setState("error");
    }
  };

  // ── Render sections from wizard_data ──
  const renderDocumentContent = () => {
    if (!instance?.wizard_data) return null;
    const wd = instance.wizard_data;

    const sections: { title: string; content: string }[] = [];

    // Identification
    sections.push({
      title: "Identification des parties",
      content: `Client : ${wd.raison_sociale || ""}
Forme juridique : ${wd.forme_juridique || ""}
SIREN : ${wd.siren || ""}
Dirigeant : ${wd.dirigeant || ""} (${wd.qualite_dirigeant || ""})
Adresse : ${wd.adresse || ""}, ${wd.cp || ""} ${wd.ville || ""}`,
    });

    // Mission type
    sections.push({
      title: "Type de mission",
      content: `Mission : ${wd.type_mission || ""}
Duree : ${wd.duree || "1"} an(s)
Date de debut : ${wd.date_debut || ""}
Reconduction tacite : ${wd.tacite_reconduction ? "Oui" : "Non"}${wd.tacite_reconduction ? `\nPreavis de resiliation : ${wd.preavis_mois || 3} mois` : ""}`,
    });

    // Missions selectionnees
    const missions = (wd.missions_selected as Array<{ label?: string; selected?: boolean }>) || [];
    const selectedMissions = missions.filter((m) => m.selected);
    if (selectedMissions.length > 0) {
      sections.push({
        title: "Missions selectionnees",
        content: selectedMissions.map((m) => `- ${m.label || "Mission"}`).join("\n"),
      });
    }

    // Intervenants
    sections.push({
      title: "Intervenants",
      content: `Associe signataire : ${wd.associe_signataire || "—"}
Chef de mission : ${wd.chef_mission || "—"}
Referent LCB-FT : ${wd.referent_lcb || "—"}`,
    });

    // Honoraires
    const honoraires = Number(wd.honoraires_ht) || 0;
    const tva = Number(wd.taux_tva) || 20;
    sections.push({
      title: "Honoraires",
      content: `Montant HT : ${honoraires.toLocaleString("fr-FR")} EUR
TVA : ${tva}%
Montant TTC : ${(honoraires * (1 + tva / 100)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} EUR
Frequence : ${wd.frequence_facturation || "MENSUEL"}
Mode de paiement : ${wd.mode_paiement || "virement"}`,
    });

    // Clauses
    const clauses: string[] = [];
    if (wd.clause_lcbft) clauses.push("Clause LCB-FT (lutte contre le blanchiment)");
    if (wd.clause_travail_dissimule) clauses.push("Clause relative au travail dissimule");
    if (wd.clause_rgpd) clauses.push("Clause RGPD (protection des donnees)");
    if (clauses.length > 0) {
      sections.push({
        title: "Clauses reglementaires",
        content: clauses.map((c) => `- ${c}`).join("\n"),
      });
    }

    // Clauses supplementaires
    if (wd.clauses_supplementaires) {
      sections.push({
        title: "Clauses supplementaires",
        content: String(wd.clauses_supplementaires),
      });
    }

    return (
      <div className="space-y-6">
        {sections.map((s, i) => (
          <div key={i}>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
              {s.title}
            </h3>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    );
  };

  // ── LOADING ──
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Chargement du document...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (state === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Lien invalide</h1>
          <p className="text-sm text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── ALREADY SIGNED ──
  if (state === "already_signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Document deja signe</h1>
          <p className="text-sm text-slate-500">
            Ce document a ete signe{signer ? ` par ${signer}` : ""}{" "}
            {signedAt ? `le ${new Date(signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  // ── SIGNED (just now) ──
  if (state === "signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Document signe avec succes</h1>
          <p className="text-sm text-slate-500">
            Signe par <strong>{signerNom}</strong> le{" "}
            {new Date(signedAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>

          {certificate && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-left space-y-2 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-700">Certificat de signature</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-400">Document</span>
                <span className="text-slate-700 font-mono">{certificate.document}</span>
                <span className="text-slate-400">Signataire</span>
                <span className="text-slate-700">{certificate.signer}</span>
                <span className="text-slate-400">Email</span>
                <span className="text-slate-700">{certificate.email}</span>
                <span className="text-slate-400">Date</span>
                <span className="text-slate-700">{new Date(certificate.signed_at).toLocaleString("fr-FR")}</span>
                <span className="text-slate-400">Methode</span>
                <span className="text-slate-700">{certificate.method}</span>
                {certificate.document_hash && (
                  <>
                    <span className="text-slate-400">Empreinte</span>
                    <span className="text-slate-700 font-mono text-[10px] break-all">{certificate.document_hash}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {certificateUrl && (
            <a
              href={certificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Telecharger le certificat
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── VIEW & SIGN ──
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">
                Lettre de Mission {instance?.numero || ""}
              </h1>
              <p className="text-[11px] text-slate-400">
                {instance?.raison_sociale} — {instance?.type_mission}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            Signature securisee
          </div>
        </div>
      </header>

      {/* Document body */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              Bonjour {clientNom},
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Veuillez prendre connaissance de la lettre de mission ci-dessous puis signer electroniquement en bas de page.
            </p>
          </div>
        </div>

        {/* Document card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Document header */}
          <div className="bg-slate-50 border-b border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Lettre de Mission n{"\u00B0"} {instance?.numero}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Creee le {instance?.created_at ? new Date(instance.created_at).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                En attente de signature
              </div>
            </div>
          </div>

          {/* Document content */}
          <div className="p-6 sm:p-8">
            {renderDocumentContent()}
          </div>
        </div>

        {/* Signature zone */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mt-6 p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Signature electronique
          </h3>

          <div className="space-y-4">
            {/* Accept checkbox */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Checkbox
                id="accept"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="accept" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                J'ai lu et j'accepte les termes de la presente lettre de mission
                et des conditions generales d'intervention ci-jointes.
              </Label>
            </div>

            {/* Signer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="signer-nom" className="text-sm font-medium text-slate-700">
                  Nom complet
                </Label>
                <Input
                  id="signer-nom"
                  value={signerNom}
                  onChange={(e) => setSignerNom(e.target.value)}
                  placeholder="Jean DUPONT"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signer-qualite" className="text-sm font-medium text-slate-700">
                  Qualite
                </Label>
                <Input
                  id="signer-qualite"
                  value={signerQualite}
                  onChange={(e) => setSignerQualite(e.target.value)}
                  placeholder="Gerant, President, Directeur..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Sign button */}
            <Button
              onClick={handleSign}
              disabled={!accepted || !signerNom.trim() || signing}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-semibold disabled:opacity-40"
            >
              {signing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {signing ? "Signature en cours..." : "Signer electroniquement"}
            </Button>

            {/* Legal notice */}
            <div className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                En cliquant sur "Signer electroniquement", vous acceptez que votre signature
                electronique ait la meme valeur juridique qu'une signature manuscrite conformement
                a l'article 1367 du Code civil. La signature sera horodatee et votre adresse IP sera enregistree
                a des fins de preuve.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-[10px] text-slate-400">
          Signature electronique securisee — GRIMY Conformite LCB-FT
        </div>
      </footer>
    </div>
  );
}
