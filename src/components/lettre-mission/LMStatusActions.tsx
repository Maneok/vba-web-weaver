import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Send, CheckCircle2, Archive, XCircle, Undo2, FileText, Loader2,
  Link2, Copy, ExternalLink, Clock,
} from "lucide-react";
import { changeStatus, STATUS_TRANSITIONS, type LMStatus } from "@/lib/lettreMissionWorkflow";
import { sendForSignature, getSignatureTokens, type SignatureToken } from "@/lib/lettreMissionSignature";
import type { SavedLetter } from "@/lib/lmWizardTypes";
import { toast } from "sonner";

interface LMStatusActionsProps {
  instance: SavedLetter;
  onStatusChange: () => void;
  onCreateAvenant?: () => void;
}

export default function LMStatusActions({ instance, onStatusChange, onCreateAvenant }: LMStatusActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showResilierDialog, setShowResilierDialog] = useState(false);
  const [email, setEmail] = useState(instance.wizard_data?.email || "");
  const [clientNom, setClientNom] = useState(instance.wizard_data?.dirigeant || instance.raison_sociale || "");
  const [motifResiliation, setMotifResiliation] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [sendingSignature, setSendingSignature] = useState(false);

  // Token status for envoyee instances
  const [tokens, setTokens] = useState<SignatureToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const currentStatus = (instance.statut || "brouillon") as LMStatus;
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];

  // Load signature tokens for envoyee/signee instances
  useEffect(() => {
    if (currentStatus === "envoyee" || currentStatus === "signee") {
      setLoadingTokens(true);
      getSignatureTokens(instance.id)
        .then(setTokens)
        .finally(() => setLoadingTokens(false));
    }
  }, [instance.id, currentStatus]);

  const doTransition = async (newStatus: LMStatus, metadata?: Record<string, string>) => {
    setLoading(true);
    try {
      await changeStatus(instance.id, newStatus, metadata);
      toast.success(`Statut mis a jour : ${newStatus}`);
      onStatusChange();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors du changement de statut");
    } finally {
      setLoading(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!email.trim()) {
      toast.error("Veuillez saisir un email");
      return;
    }
    if (!clientNom.trim()) {
      toast.error("Veuillez saisir le nom du client");
      return;
    }

    setSendingSignature(true);
    try {
      const result = await sendForSignature(
        instance.id,
        email.trim(),
        clientNom.trim()
      );
      setSignatureUrl(result.signatureUrl);

      // Also transition to envoyee if still brouillon
      if (currentStatus === "brouillon") {
        await changeStatus(instance.id, "envoyee", { sent_to_email: email.trim() });
      }

      toast.success("Lien de signature cree !");
      onStatusChange();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la creation du lien");
    } finally {
      setSendingSignature(false);
    }
  };

  const handleResilier = async () => {
    if (!motifResiliation.trim()) {
      toast.error("Veuillez saisir un motif de resiliation");
      return;
    }
    setShowResilierDialog(false);
    await doTransition("resiliee", { resiliee_motif: motifResiliation.trim() });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Lien copie dans le presse-papier");
    });
  };

  const latestToken = tokens[0];
  const tokenStatus = latestToken
    ? latestToken.is_used
      ? "signe"
      : new Date(latestToken.expires_at) < new Date()
      ? "expire"
      : "en_attente"
    : null;

  if (allowed.length === 0 && currentStatus !== "signee") return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {/* Brouillon → Envoyer pour signature */}
          {currentStatus === "brouillon" && allowed.includes("envoyee") && (
            <Button
              size="sm"
              onClick={() => setShowSendDialog(true)}
              disabled={loading}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Envoyer pour signature
            </Button>
          )}

          {/* Envoyee → Signee (manual) */}
          {currentStatus === "envoyee" && allowed.includes("signee") && (
            <Button
              size="sm"
              onClick={() => doTransition("signee")}
              disabled={loading}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Marquer comme signee
            </Button>
          )}

          {/* Envoyee → Renvoyer lien */}
          {currentStatus === "envoyee" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSendDialog(true)}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-blue-400 text-xs"
            >
              <Link2 className="w-3 h-3" /> Renvoyer lien
            </Button>
          )}

          {/* Envoyee → Brouillon (retour) */}
          {currentStatus === "envoyee" && allowed.includes("brouillon") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => doTransition("brouillon")}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-slate-400 text-xs"
            >
              <Undo2 className="w-3 h-3" /> Repasser en brouillon
            </Button>
          )}

          {/* Signee → Archiver */}
          {currentStatus === "signee" && allowed.includes("archivee") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => doTransition("archivee")}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-purple-400 text-xs"
            >
              <Archive className="w-3 h-3" /> Archiver
            </Button>
          )}

          {/* Signee → Resilier */}
          {currentStatus === "signee" && allowed.includes("resiliee") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowResilierDialog(true)}
              disabled={loading}
              className="gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs"
            >
              <XCircle className="w-3 h-3" /> Resilier
            </Button>
          )}

          {/* Signee → Creer avenant */}
          {currentStatus === "signee" && onCreateAvenant && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCreateAvenant}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-amber-400 text-xs"
            >
              <FileText className="w-3 h-3" /> Creer un avenant
            </Button>
          )}

          {/* Brouillon / Envoyee → Archiver */}
          {(currentStatus === "brouillon" || currentStatus === "envoyee") && allowed.includes("archivee") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => doTransition("archivee")}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-slate-500 text-xs"
            >
              <Archive className="w-3 h-3" /> Archiver
            </Button>
          )}

          {/* Resiliee → Archiver */}
          {currentStatus === "resiliee" && allowed.includes("archivee") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => doTransition("archivee")}
              disabled={loading}
              className="gap-1.5 border-white/[0.08] text-purple-400 text-xs"
            >
              <Archive className="w-3 h-3" /> Archiver
            </Button>
          )}
        </div>

        {/* Signature token status for envoyee instances */}
        {currentStatus === "envoyee" && latestToken && (
          <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Link2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Lien de signature</span>
              {tokenStatus === "en_attente" && (
                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
                  <Clock className="w-2.5 h-2.5" /> En attente
                </Badge>
              )}
              {tokenStatus === "signe" && (
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Signe
                </Badge>
              )}
              {tokenStatus === "expire" && (
                <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                  <Clock className="w-2.5 h-2.5" /> Expire
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 text-[10px] text-slate-500 bg-white/[0.03] rounded px-2 py-1 truncate font-mono">
                {`/signer?token=${latestToken.token.slice(0, 12)}...`}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-500 hover:text-blue-400"
                onClick={() => copyToClipboard(`https://vba-web-weaver.vercel.app/signer?token=${latestToken.token}`)}
                title="Copier le lien"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <a
                href={`https://vba-web-weaver.vercel.app/signer?token=${latestToken.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-6 w-6 p-0 flex items-center justify-center rounded text-slate-500 hover:text-blue-400 hover:bg-white/[0.06] transition-colors"
                title="Ouvrir"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[10px] text-slate-600">
              Envoye a {latestToken.client_email} — Expire le {new Date(latestToken.expires_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        )}

        {/* Signature info for signed instances */}
        {currentStatus === "signee" && latestToken?.is_used && latestToken.signed_at && (
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Signe electroniquement</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Par {latestToken.client_nom} le {new Date(latestToken.signed_at).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
              {latestToken.signer_ip && ` — IP: ${latestToken.signer_ip}`}
            </p>
            {latestToken.document_hash && (
              <p className="text-[9px] text-slate-600 font-mono break-all">
                Empreinte : {latestToken.document_hash}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dialog Envoyer pour signature */}
      <Dialog open={showSendDialog} onOpenChange={(open) => { setShowSendDialog(open); if (!open) setSignatureUrl(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer pour signature electronique</DialogTitle>
            <DialogDescription>
              Un lien unique sera genere pour que votre client puisse consulter et signer la lettre de mission.
            </DialogDescription>
          </DialogHeader>

          {!signatureUrl ? (
            <>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="send-email" className="text-sm">Email du client</Label>
                  <Input
                    id="send-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="send-nom" className="text-sm">Nom du signataire</Label>
                  <Input
                    id="send-nom"
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    placeholder="Jean DUPONT"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSendDialog(false)}>Annuler</Button>
                <Button
                  onClick={handleSendForSignature}
                  disabled={sendingSignature}
                  className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                >
                  {sendingSignature ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Generer le lien
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Lien de signature cree</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={signatureUrl}
                    className="text-xs font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(signatureUrl)}
                    className="shrink-0 gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copier
                  </Button>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>Ce lien est valable 30 jours. Le client pourra :</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Consulter la lettre de mission en ligne</li>
                  <li>Signer electroniquement en un clic</li>
                  <li>Recevoir un certificat de signature</li>
                </ul>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `mailto:${email}?subject=Lettre de mission a signer&body=Bonjour ${clientNom},%0A%0AVeuillez consulter et signer votre lettre de mission en cliquant sur le lien suivant :%0A%0A${encodeURIComponent(signatureUrl)}%0A%0ACordialement`;
                  }}
                  className="gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Envoyer par email
                </Button>
                <Button onClick={() => setShowSendDialog(false)}>Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Resilier */}
      <Dialog open={showResilierDialog} onOpenChange={setShowResilierDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resilier la lettre de mission</DialogTitle>
            <DialogDescription>
              Cette action est irreversible. La lettre ne pourra plus etre modifiee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="motif" className="text-sm">Motif de resiliation</Label>
              <Textarea
                id="motif"
                value={motifResiliation}
                onChange={(e) => setMotifResiliation(e.target.value)}
                placeholder="Indiquez le motif de la resiliation..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResilierDialog(false)}>Annuler</Button>
            <Button onClick={handleResilier} variant="destructive" className="gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Confirmer la resiliation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
