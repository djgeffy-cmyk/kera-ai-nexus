import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Agents from "./pages/Agents.tsx";
import Security from "./pages/Security.tsx";
import Transparencia from "./pages/Transparencia.tsx";
import TransparenciaHistorico from "./pages/TransparenciaHistorico.tsx";
import NotFound from "./pages/NotFound.tsx";
import KeraDesktopPage from "./pages/KeraDesktop.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Footer from "./components/Footer";
import { LicitacoesAlertsListener } from "./components/LicitacoesAlertsListener";
import { AskKeraFab } from "./components/AskKeraFab";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <HashRouter>
        <LicitacoesAlertsListener />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/transparencia" element={<ProtectedRoute><Transparencia /></ProtectedRoute>} />
          <Route path="/transparencia/historico" element={<ProtectedRoute><TransparenciaHistorico /></ProtectedRoute>} />
          <Route path="/desktop" element={<ProtectedRoute><KeraDesktopPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <AskKeraFab />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
