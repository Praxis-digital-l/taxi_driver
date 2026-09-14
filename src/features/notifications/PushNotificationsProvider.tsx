import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { subscribeDeviceForPush } from "./pushNotifications";

/**
 * Configura la notificación push del dispositivo cuando hay una sesión iniciada.
 * Se monta una sola vez a nivel de App.
 */
export default function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role !== "conductor") return;
    subscribeDeviceForPush(user.id);
  }, [loading, user, profile]);

  return <>{children}</>;
}