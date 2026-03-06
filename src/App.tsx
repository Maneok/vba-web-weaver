import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/lib/AppContext";
import AppLayout from "@/components/AppLayout";
import CockpitPage from "@/pages/CockpitPage";
import DashboardPage from "@/pages/DashboardPage";
import BddPage from "@/pages/BddPage";
import GouvernancePage from "@/pages/GouvernancePage";
import ControlePage from "@/pages/ControlePage";
import RegistrePage from "@/pages/RegistrePage";
import LogsPage from "@/pages/LogsPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<CockpitPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bdd" element={<BddPage />} />
              <Route path="/gouvernance" element={<GouvernancePage />} />
              <Route path="/controle" element={<ControlePage />} />
              <Route path="/registre" element={<RegistrePage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
