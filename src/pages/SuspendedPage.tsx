import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="mx-auto text-red-400 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-white mb-2">Compte suspendu</h1>
        <p className="text-white/60 mb-6">
          L'abonnement de votre cabinet est suspendu. Contactez votre administrateur pour réactiver l'accès.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            supabase.auth.signOut().then(() => (window.location.href = "/auth"))
          }
        >
          <LogOut className="mr-2" size={16} /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}
