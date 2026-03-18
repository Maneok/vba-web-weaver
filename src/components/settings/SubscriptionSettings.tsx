import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Crown,
  Users,
  UserPlus,
  Calendar,
  Clock,
  Loader2,
  CreditCard,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logger } from "@/lib/logger";

/* ---------- types ---------- */

type PlanType = "trial" | "solo" | "cabinet" | "enterprise";
type SubscriptionStatus = "active" | "past_due" | "suspended" | "trialing";
type BillingCycle = "monthly" | "annual";

interface CabinetUsage {
  plan: PlanType;
  status: SubscriptionStatus;
  seats_used: number;
  seats_limit: number;
  clients_used: number;
  clients_limit: number;
  pending_invitations: number;
  trial_days_remaining: number | null;
  billing_cycle: BillingCycle;
  current_period_end: string | null;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
}

/* ---------- constants ---------- */

const PLAN_CONFIG: Record<PlanType, { label: string; color: string; bgColor: string }> = {
  trial: { label: "Essai", color: "text-blue-300", bgColor: "bg-blue-500/20 border-blue-500/30" },
  solo: { label: "Solo", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-500/20 border-slate-500/30" },
  cabinet: { label: "Cabinet", color: "text-blue-300", bgColor: "bg-blue-500/20 border-blue-500/30" },
  enterprise: { label: "Enterprise", color: "text-purple-300", bgColor: "bg-purple-500/20 border-purple-500/30" },
};

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: "Actif", color: "text-green-300", bgColor: "bg-green-500/20 border-green-500/30" },
  past_due: { label: "Paiement en retard", color: "text-orange-300", bgColor: "bg-orange-500/20 border-orange-500/30" },
  suspended: { label: "Suspendu", color: "text-red-300", bgColor: "bg-red-500/20 border-red-500/30" },
  trialing: { label: "Periode d'essai", color: "text-blue-300", bgColor: "bg-blue-500/20 border-blue-500/30" },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  paid: { label: "Paye", color: "text-green-400" },
  pending: { label: "En attente", color: "text-orange-400" },
  failed: { label: "Echoue", color: "text-red-400" },
  refunded: { label: "Rembourse", color: "text-slate-400 dark:text-slate-500 dark:text-slate-400" },
};

const PLANS = [
  {
    id: "solo" as PlanType,
    name: "Solo",
    price: "29",
    priceAnnual: "24",
    features: ["1 utilisateur", "50 clients", "Scoring de risque", "Lettres de mission", "Support email"],
  },
  {
    id: "cabinet" as PlanType,
    name: "Cabinet",
    price: "79",
    priceAnnual: "66",
    popular: true,
    features: ["5 utilisateurs", "500 clients", "Tout Solo +", "GED & OCR", "Screening sanctions", "Support prioritaire"],
  },
  {
    id: "enterprise" as PlanType,
    name: "Enterprise",
    price: "199",
    priceAnnual: "166",
    features: ["Utilisateurs illimites", "Clients illimites", "Tout Cabinet +", "API & integrations", "SSO / SAML", "Support dedie"],
  },
];

/* ---------- helpers ---------- */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/* ---------- component ---------- */

export default function SubscriptionSettings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<CabinetUsage | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [addingSeat, setAddingSeat] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);

  useEffect(() => {
    if (!profile?.cabinet_id) return;

    let cancelled = false;

    async function loadUsage() {
      try {
        const { data, error } = await supabase.rpc("get_cabinet_usage", {
          p_cabinet_id: profile!.cabinet_id,
        });

        if (cancelled) return;

        if (error) {
          logger.error("Subscription", "Erreur chargement usage:", error);
          toast.error("Erreur lors du chargement des donnees d'abonnement");
          setLoading(false);
          return;
        }

        if (data) {
          setUsage(data as unknown as CabinetUsage);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          logger.error("Subscription", "Erreur inattendue:", err);
          toast.error("Erreur lors du chargement des donnees d'abonnement");
        }
      }

      // Load payment history
      try {
        const { data: historyData, error: historyError } = await supabase
          .from("payment_history")
          .select("*")
          .eq("cabinet_id", profile!.cabinet_id)
          .order("date", { ascending: false })
          .limit(20);

        if (cancelled) return;

        if (!historyError && historyData) {
          setPayments(historyData as unknown as PaymentRecord[]);
        }
      } catch {
        // Payment history is non-critical
      }

      setLoading(false);
    }

    loadUsage();
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

  async function handleAddSeat() {
    if (!profile?.cabinet_id) return;
    setAddingSeat(true);
    try {
      const { error } = await supabase.rpc("add_extra_seat", {
        p_cabinet_id: profile.cabinet_id,
      });
      if (error) {
        toast.error("Erreur lors de l'ajout du siege");
        logger.error("Subscription", "Erreur ajout siege:", error);
      } else {
        toast.success("Siege supplementaire ajoute avec succes");
        // Reload usage
        const { data } = await supabase.rpc("get_cabinet_usage", {
          p_cabinet_id: profile.cabinet_id,
        });
        if (data) setUsage(data as unknown as CabinetUsage);
      }
    } catch (err: unknown) {
      toast.error("Erreur lors de l'ajout du siege");
      logger.error("Subscription", "Erreur inattendue:", err);
    }
    setAddingSeat(false);
  }

  /* --- loading skeleton --- */
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card border border-white/10 rounded-xl p-6">
            <div className="space-y-3">
              <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
              <div className="h-8 w-full bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-5 h-5" />
          <p>Impossible de charger les donnees d'abonnement. Veuillez reessayer plus tard.</p>
        </div>
      </div>
    );
  }

  const planConfig = PLAN_CONFIG[usage.plan];
  const statusConfig = STATUS_CONFIG[usage.status];
  const seatsPercent = usage.seats_limit > 0 ? Math.round((usage.seats_used / usage.seats_limit) * 100) : 0;
  const clientsPercent = usage.clients_limit > 0 ? Math.round((usage.clients_used / usage.clients_limit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Plan & Status */}
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              Abonnement
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">Gerez votre plan et vos ressources.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Plan */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plan actuel</p>
            <Badge className={`${planConfig.bgColor} ${planConfig.color} border text-sm`}>
              {planConfig.label}
            </Badge>
          </div>

          {/* Status */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Statut</p>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border text-sm`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Billing cycle */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cycle de facturation</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <span className="text-sm text-slate-800 dark:text-slate-200">
                {usage.billing_cycle === "annual" ? "Annuel" : "Mensuel"}
              </span>
            </div>
          </div>

          {/* Trial days or period end */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            {usage.trial_days_remaining != null ? (
              <>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jours restants</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300 font-medium">
                    {usage.trial_days_remaining} jour{usage.trial_days_remaining !== 1 ? "s" : ""}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Prochain renouvellement</p>
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  {usage.current_period_end ? formatDate(usage.current_period_end) : "—"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Utilisation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">Sieges utilises</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
                {usage.seats_used} / {usage.seats_limit}
              </span>
            </div>
            <Progress
              value={seatsPercent}
              className="h-2.5 bg-white/10"
            />
            {usage.pending_invitations > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                {usage.pending_invitations} invitation{usage.pending_invitations > 1 ? "s" : ""} en attente
              </p>
            )}
          </div>

          {/* Clients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">Clients</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
                {usage.clients_used} / {usage.clients_limit}
              </span>
            </div>
            <Progress
              value={clientsPercent}
              className="h-2.5 bg-white/10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSeat}
            disabled={addingSeat}
            className="gap-2 border-white/10 hover:bg-white/5"
          >
            {addingSeat ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Ajouter un siege (+15€/mois)
          </Button>

          <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5">
                <Crown className="w-4 h-4" />
                Changer de plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-gray-50 dark:bg-slate-900 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Changer de plan</DialogTitle>
                <DialogDescription className="text-slate-400 dark:text-slate-500 dark:text-slate-400">
                  Selectionnez le plan qui correspond le mieux a vos besoins.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === usage.plan;
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-xl border p-5 space-y-4 transition-colors ${
                        plan.popular
                          ? "border-blue-500/50 bg-blue-500/5"
                          : "border-white/10 bg-white/5"
                      } ${isCurrent ? "ring-2 ring-blue-500/50" : ""}`}
                    >
                      {plan.popular && (
                        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500 text-slate-900 dark:text-white text-[10px]">
                          Populaire
                        </Badge>
                      )}
                      <div>
                        <h3 className="text-base font-semibold text-slate-100">{plan.name}</h3>
                        <div className="mt-2">
                          <span className="text-2xl font-bold text-slate-100">{plan.price}€</span>
                          <span className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">/mois</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          ou {plan.priceAnnual}€/mois (annuel)
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={isCurrent ? "secondary" : "default"}
                        size="sm"
                        className="w-full"
                        disabled={isCurrent}
                        onClick={() => {
                          toast.info(`Migration vers le plan ${plan.name} en cours...`);
                          setChangePlanOpen(false);
                        }}
                      >
                        {isCurrent ? "Plan actuel" : "Selectionner"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Payment history */}
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
          Historique des paiements
        </h2>

        {payments.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucun paiement enregistre.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Description</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-right">Montant</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const statusCfg = PAYMENT_STATUS_CONFIG[payment.status] || {
                    label: payment.status,
                    color: "text-slate-400 dark:text-slate-500 dark:text-slate-400",
                  };
                  return (
                    <TableRow key={payment.id} className="border-white/10">
                      <TableCell className="text-slate-700 dark:text-slate-300 text-sm">
                        {formatDate(payment.date)}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300 text-sm">
                        {payment.description}
                      </TableCell>
                      <TableCell className="text-slate-800 dark:text-slate-200 text-sm text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
