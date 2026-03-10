import { AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SuspendedPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-100">
            Abonnement suspendu
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            L'abonnement de votre cabinet est suspendu.
            Contactez votre administrateur.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20 transition-colors text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </button>
      </div>
    </div>
  );
}
