import { useLocation, useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useDocumentTitle("Page Introuvable");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-6 animate-fade-in-up">
        {/* Animated 404 */}
        <div className="relative">
          <p className="text-[120px] font-black leading-none bg-gradient-to-b from-blue-500/30 to-transparent bg-clip-text text-transparent select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-12 h-12 text-blue-500/40 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Page introuvable</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            La page <code className="text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-blue-300">{location.pathname}</code> n'existe pas ou a ete deplacee.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Home className="w-4 h-4" /> Accueil
          </Button>
        </div>

        <p className="text-[10px] text-slate-600">
          Si le probleme persiste, contactez votre administrateur.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
