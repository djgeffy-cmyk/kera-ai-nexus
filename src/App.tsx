import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Welcome from "./pages/Welcome.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Agents from "./pages/Agents.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Planos from "./pages/Planos.tsx";
import AdminUso from "./pages/AdminUso.tsx";
import Security from "./pages/Security.tsx";
import HumorKera from "./pages/HumorKera.tsx";
import Transparencia from "./pages/Transparencia.tsx";
import TransparenciaHistorico from "./pages/TransparenciaHistorico.tsx";
import NotFound from "./pages/NotFound.tsx";
import KeraDesktopPage from "./pages/KeraDesktop.tsx";
import Manual from "./pages/Manual.tsx";
import Uso from "./pages/Uso.tsx";
import Builds from "./pages/Builds.tsx";
import Processos from "./pages/Processos.tsx";
import InstallIOS from "./pages/InstallIOS.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Footer from "./components/Footer";
import { LicitacoesAlertsListener } from "./components/LicitacoesAlertsListener";
import { AskKeraFab } from "./components/AskKeraFab";
import { IconUpdateBanner } from "./components/IconUpdateBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <HashRouter>
        <LicitacoesAlertsListener />
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/planos" element={<ProtectedRoute><Planos /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="/admin/uso" element={<ProtectedRoute requireAdmin><AdminUso /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/humor" element={<ProtectedRoute><HumorKera /></ProtectedRoute>} />
          <Route path="/transparencia" element={<ProtectedRoute><Transparencia /></ProtectedRoute>} />
          <Route path="/transparencia/historico" element={<ProtectedRoute><TransparenciaHistorico /></ProtectedRoute>} />
          <Route path="/desktop" element={<ProtectedRoute><KeraDesktopPage /></ProtectedRoute>} />
          <Route path="/manual" element={<ProtectedRoute><Manual /></ProtectedRoute>} />
          <Route path="/uso" element={<ProtectedRoute><Uso /></ProtectedRoute>} />
          <Route path="/builds" element={<ProtectedRoute><Builds /></ProtectedRoute>} />
          <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
          <Route path="/install-ios" element={<InstallIOS />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <AskKeraFab />
        <IconUpdateBanner />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
