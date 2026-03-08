import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/lib/AppContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "@/pages/AuthPage";

import DashboardPage from "@/pages/DashboardPage";
import BddPage from "@/pages/BddPage";
import GouvernancePage from "@/pages/GouvernancePage";
import ControlePage from "@/pages/ControlePage";
import RegistrePage from "@/pages/RegistrePage";
import LogsPage from "@/pages/LogsPage";
import NouveauClientPage from "@/pages/NouveauClientPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import DiagnosticPage from "@/pages/DiagnosticPage";
import SettingsPage from "@/pages/SettingsPage";
import GedPage from "@/pages/GedPage";
import LettreMissionPage from "@/pages/LettreMissionPage";
import NotFound from "@/pages/NotFound";
import LandingPage from "@/pages/LandingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="bdd" element={<BddPage />} />
                <Route path="nouveau-client" element={<NouveauClientPage />} />
                <Route path="client/:ref" element={<ClientDetailPage />} />
                <Route path="gouvernance" element={<GouvernancePage />} />
                <Route path="controle" element={<ControlePage />} />
                <Route path="registre" element={<RegistrePage />} />
                <Route path="logs" element={<LogsPage />} />
                <Route path="ged" element={<GedPage />} />
                <Route path="lettre-mission" element={<LettreMissionPage />} />
                <Route path="lettre-mission/:ref" element={<LettreMissionPage />} />
                <Route path="diagnostic" element={<DiagnosticPage />} />
                <Route path="parametres" element={<SettingsPage />} />
                <Route path="settings" element={<Navigate to="/parametres" replace />} />
                <Route path="dashboard" element={<Navigate to="/" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
