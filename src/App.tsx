import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AppProvider } from "@/lib/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

import DashboardPage from "@/pages/DashboardPage";
import BddPage from "@/pages/BddPage";
import GouvernancePage from "@/pages/GouvernancePage";
import ControlePage from "@/pages/ControlePage";
import RegistrePage from "@/pages/RegistrePage";
import LogsPage from "@/pages/LogsPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
