import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLANS = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: 29,
    description: "Pour les cabinets individuels",
    features: [
      "Jusqu'a 50 clients",
      "Matrice de risque automatique",
      "Dashboard LCB-FT",
      "Export PDF fiches client",
      "Support email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 59,
    popular: true,
    description: "Pour les cabinets en croissance",
    features: [
      "Jusqu'a 200 clients",
      "Tout Essentiel +",
      "GED intelligente",
      "Alertes expiration documents",
      "Registre LCB automatise",
      "Controle qualite integre",
      "Support prioritaire",
    ],
  },
  {
    id: "cabinet",
    name: "Cabinet",
    price: 99,
    description: "Pour les grands cabinets",
    features: [
      "Clients illimites",
      "Tout Pro +",
      "Multi-collaborateurs",
      "API & integrations",
      "Gouvernance avancee",
      "Audit trail complet",
      "Support dedie + onboarding",
    ],
  },
];

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          plan: planId,
          email,
          returnUrl: window.location.origin,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Pas d'URL de paiement recue");
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erreur lors de la creation de la session de paiement"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">MATRICE LCB-FT</h1>
            <p className="text-xs text-muted-foreground">Conformite anti-blanchiment pour experts-comptables</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Choisissez votre plan</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Simplifiez votre conformite LCB-FT. Sans engagement, resiliable a tout moment.
          </p>
        </div>

        {/* Email input */}
        <div className="max-w-sm mx-auto mb-10">
          <label className="text-sm font-medium mb-2 block text-center">Votre adresse email professionnelle</label>
          <Input
            type="email"
            placeholder="nom@cabinet.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center"
          />
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.popular
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Populaire
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">&euro;/mois</span>
                  <p className="text-xs text-muted-foreground mt-1">HT</p>
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                  disabled={loading !== null}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirection...
                    </>
                  ) : (
                    `Commencer avec ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center mt-10 text-sm text-muted-foreground space-y-1">
          <p>Paiement securise par Stripe. Facturation mensuelle.</p>
          <p>14 jours d'essai gratuit sur tous les plans.</p>
        </div>
      </div>
    </div>
  );
}
