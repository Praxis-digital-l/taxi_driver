import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";

interface Props {
  children: React.ReactNode;
  requiredRole?: "admin" | "conductor" | "super_admin";
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, profile, loading } = useAuth();

  const getHomePath = (role: Props["requiredRole"]) => (
    role === "conductor" ? "/conductor" : "/admin"
  );

  const hasRequiredRole = (role: Props["requiredRole"], required: Props["requiredRole"]) => {
    if (!role || !required) return false;
    if (required === "admin") return role === "admin" || role === "super_admin";
    return role === required;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
  if (requiredRole && !hasRequiredRole(profile.role, requiredRole)) {
    return <Navigate to={getHomePath(profile.role)} replace />;
  }

  return <>{children}</>;
}
