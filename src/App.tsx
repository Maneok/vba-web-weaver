import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/lib/AppContext";
import AppLayout from "@/components/AppLayout";

import DashboardPage from "@/pages/DashboardPage";
import BddPage from "@/pages/BddPage";
import GouvernancePage from "@/pages/GouvernancePage";
import ControlePage from "@/pages/ControlePage";
import RegistrePage from "@/pages/RegistrePage";
import LogsPage from "@/pages/LogsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="bdd" element={<BddPage />} />
              <Route path="gouvernance" element={<GouvernancePage />} />
              <Route path="controle" element={<ControlePage />} />
              <Route path="registre" element={<RegistrePage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="parametres" element={<SettingsPage />} />
              <Route path="settings" element={<Navigate to="/parametres" replace />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
