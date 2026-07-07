import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/features/auth/context/AuthContext";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import AppLayout from "@/shared/layouts/AppLayout";
import Auth from "@/features/auth/pages/AuthPage";
import ConductorDashboard from "@/features/conductor/pages/ConductorDashboard";
import ConductorVehicles from "@/features/conductor/pages/ConductorVehicles";
import ConductorDocuments from "@/features/conductor/pages/ConductorDocuments";
import ConductorRequests from "@/features/conductor/pages/ConductorRequests";
import ConductorMileage from "@/features/conductor/pages/ConductorMileage";
import ConductorMessages from "@/features/conductor/pages/ConductorMessages";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminSearch from "@/features/admin/pages/AdminSearch";
import AdminVehicles from "@/features/admin/pages/AdminVehicles";
import AdminRequests from "@/features/admin/pages/AdminRequests";
import AdminMessages from "@/features/admin/pages/AdminMessages";
import AdminUsers from "@/features/admin/pages/AdminUsers";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

/** Redirige al dashboard según el rol del usuario autenticado */
function RootRedirect() {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Preparando perfil...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={profile.role === "conductor" ? "/conductor" : "/admin"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<Auth />} />

            {/* Rutas Conductor */}
            <Route path="/conductor" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/conductor/vehicles" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorVehicles /></AppLayout></ProtectedRoute>} />
            <Route path="/conductor/documents" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorDocuments /></AppLayout></ProtectedRoute>} />
            <Route path="/conductor/requests" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorRequests /></AppLayout></ProtectedRoute>} />
            <Route path="/conductor/mileage" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorMileage /></AppLayout></ProtectedRoute>} />
            <Route path="/conductor/messages" element={<ProtectedRoute requiredRole="conductor"><AppLayout><ConductorMessages /></AppLayout></ProtectedRoute>} />

            {/* Rutas Admin */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/search" element={<ProtectedRoute requiredRole="admin"><AppLayout><AdminSearch /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/vehicles" element={<ProtectedRoute requiredRole="admin"><AppLayout><AdminVehicles /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/requests" element={<ProtectedRoute requiredRole="admin"><AppLayout><AdminRequests /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requiredRole="admin"><AppLayout><AdminMessages /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="super_admin"><AppLayout><AdminUsers /></AppLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
