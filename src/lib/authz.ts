import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const DEFAULT_ROUTE_BY_ROLE: Record<AppRole, string> = {
  admin: "/admin",
  conductor: "/conductor",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  conductor: "Conductor",
};

export function getHomeRouteForRole(role: AppRole) {
  return DEFAULT_ROUTE_BY_ROLE[role];
}

export function getDeniedMessage(requiredRole: AppRole, currentRole: AppRole) {
  if (requiredRole === currentRole) {
    return "";
  }

  if (requiredRole === "admin") {
    return "Acceso denegado: esta seccion solo esta disponible para administradores autorizados.";
  }

  return "Acceso denegado: esta seccion solo esta disponible para conductores.";
}
