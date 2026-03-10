import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useDocumentTitle("Paiement Confirme");

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) navigate("/");
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Paiement confirme !</h1>
          <p className="text-muted-foreground">
            Votre abonnement est actif. Un email avec vos identifiants de connexion
            vous a ete envoye.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirection automatique dans {countdown}s...
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Acceder au Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
