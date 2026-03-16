import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Send, CheckCircle2, Archive, XCircle, Undo2, FileText, Loader2,
} from "lucide-react";
import { changeStatus, STATUS_TRANSITIONS, type LMStatus } from "@/lib/lettreMissionWorkflow";
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
  const [motifResiliation, setMotifResiliation] = useState("");

  const currentStatus = (instance.statut || "brouillon") as LMStatus;
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];

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

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error("Veuillez saisir un email");
      return;
    }
    setShowSendDialog(false);
    await doTransition("envoyee", { sent_to_email: email.trim() });
  };

  const handleResilier = async () => {
    if (!motifResiliation.trim()) {
      toast.error("Veuillez saisir un motif de resiliation");
      return;
    }
    setShowResilierDialog(false);
    await doTransition("resiliee", { resiliee_motif: motifResiliation.trim() });
  };

  if (allowed.length === 0 && currentStatus !== "signee") return null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {/* Brouillon → Envoyer */}
        {currentStatus === "brouillon" && allowed.includes("envoyee") && (
          <Button
            size="sm"
            onClick={() => setShowSendDialog(true)}
            disabled={loading}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Envoyer au client
          </Button>
        )}

        {/* Envoyee → Signee */}
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

      {/* Dialog Envoyer */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer la lettre de mission</DialogTitle>
            <DialogDescription>
              La lettre de mission sera marquee comme envoyee.
              Saisissez l'email du client pour suivi.
            </DialogDescription>
          </DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Annuler</Button>
            <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Send className="w-3.5 h-3.5" /> Envoyer
            </Button>
          </DialogFooter>
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
