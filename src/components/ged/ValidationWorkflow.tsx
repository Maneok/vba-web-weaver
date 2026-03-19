import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import DocumentStatusBadge from "./DocumentStatusBadge";

interface ValidationWorkflowProps {
  docId: string;
  currentStatus: "pending" | "validated" | "rejected";
  rejectionReason?: string;
  validatedBy?: string;
  validatedAt?: string;
  onValidate: (docId: string) => Promise<void>;
  onReject: (docId: string, reason: string) => Promise<void>;
}

export default function ValidationWorkflow({
  docId,
  currentStatus,
  rejectionReason,
  validatedBy,
  validatedAt,
  onValidate,
  onReject,
}: ValidationWorkflowProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    try {
      await onValidate(docId);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try {
      await onReject(docId, rejectReason.trim());
      setShowRejectForm(false);
      setRejectReason("");
    } finally {
      setLoading(false);
    }
  };

  const handleRevalidate = async () => {
    setLoading(true);
    try {
      await onValidate(docId);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelValidation = async () => {
    // Cancel validation = set back to pending by rejecting with empty reason
    // We reuse onReject with a special marker, or we call onValidate to toggle
    // For simplicity, we call onReject to go back to pending state
    setLoading(true);
    try {
      await onReject(docId, "");
    } finally {
      setLoading(false);
    }
  };

  if (currentStatus === "pending") {
    return (
      <div className="space-y-3">
        {!showRejectForm ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={handleValidate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              )}
              Valider
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
              onClick={() => setShowRejectForm(true)}
              disabled={loading}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Rejeter
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Motif du rejet (obligatoire)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                )}
                Confirmer le rejet
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentStatus === "validated") {
    return (
      <div className="space-y-3">
        <DocumentStatusBadge
          status="validated"
          validatedBy={validatedBy}
          validatedAt={validatedAt}
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={handleCancelValidation}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 mr-1.5" />
          )}
          Annuler la validation
        </Button>
      </div>
    );
  }

  // rejected
  return (
    <div className="space-y-3">
      <DocumentStatusBadge
        status="rejected"
        rejectionReason={rejectionReason}
      />
      <Button
        variant="outline"
        size="sm"
        className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
        onClick={handleRevalidate}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
        )}
        Revalider
      </Button>
    </div>
  );
}
