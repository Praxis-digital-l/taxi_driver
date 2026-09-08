import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { useLocation } from "react-router-dom";

const getInitials = (name?: string | null) =>
  (name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function ConductorMessages() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [messages, setMessages] = useState<Array<{
    id: string;
    status: string;
    content: string;
    created_at: string;
    read_at?: string | null;
    sender?: { full_name?: string | null } | null;
  }>>([]);

  const [detailMsg, setDetailMsg] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const OLD_STATUSES = ["pendiente", "en_proceso", "completado"];

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

  const markAsVisto = async (msg: any) => {
    if (msg.status === "visto") return msg;
    const { error } = await supabase.rpc("mark_message_read", { msg_id: msg.id });
    if (error) {
      console.error("Error al marcar como visto:", error.message, error.details, error.hint);
      toast({ title: "Error al marcar como visto", description: error.message, variant: "destructive" });
      return msg;
    }
    const now = new Date().toISOString();
    const updated = { ...msg, status: "visto", read_at: msg.read_at ?? now };
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "visto", read_at: m.read_at ?? now } : m));
    return updated;
  };

  const openDetail = async (msg: any) => {
    const updated = await markAsVisto(msg);
    setDetailMsg(updated);
    setDetailOpen(true);
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*, sender:profiles!messages_sender_id_fkey(full_name)")
      .eq("receiver_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    let msgs = data || [];
    const toMigrate = msgs.filter((m: any) => OLD_STATUSES.includes(m.status));
    if (toMigrate.length > 0) {
      await Promise.all(toMigrate.map((m: any) => supabase.from("messages").update({ status: "enviado" }).eq("id", m.id)));
      msgs = msgs.map((m: any) => OLD_STATUSES.includes(m.status) ? { ...m, status: "enviado" } : m);
    }
    setMessages(msgs);
  }, [profile, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [profile, load]);

  useEffect(() => {
    if (!location.state || !messages.length) return;
    const state = location.state as any;
    if (state.openMessageId) {
      const found = messages.find((m: any) => m.id === state.openMessageId);
      if (found) openDetail(found);
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, messages]);

  return (
    <div>
      <PageHeader title="Mensajes" description={`${messages.length} mensaje(s) recibido(s)`} />

      {messages.length === 0 ? (
        <Card><CardContent className="empty-state"><MessageSquare /><p>No tienes mensajes.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {messages.map((msg) => {
            const unread = msg.status !== "visto";
            return (
              <Card
                key={msg.id}
                className={cn(
                  "stat-card cursor-pointer overflow-hidden transition-colors hover:border-primary/40 hover:bg-muted/40",
                  unread && "border-l-4 border-l-info",
                )}
                onClick={() => openDetail(msg)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(msg.sender?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm truncate", unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                          {msg.sender?.full_name || "Administrador"}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className={cn("text-sm leading-relaxed break-all whitespace-pre-wrap line-clamp-2", unread ? "text-foreground" : "text-muted-foreground")}>
                        {msg.content}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <StatusBadge status={msg.status} />
                        {unread && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-info">
                            <span className="h-1.5 w-1.5 rounded-full bg-info" />Nuevo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Detalle del Mensaje</DialogTitle>
          </DialogHeader>
          {detailMsg && (
            <div className="space-y-4 text-sm min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {getInitials(detailMsg.sender?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{detailMsg.sender?.full_name ?? "Administrador"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(detailMsg.created_at)}</p>
                  </div>
                </div>
                <StatusBadge status={detailMsg.status} className="shrink-0" />
              </div>

              <div className="min-w-0">
                <div className="rounded-2xl rounded-tl-sm border bg-muted/40 p-4 text-sm max-h-72 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {detailMsg.content || "Sin contenido"}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                <span>Recibido: {new Date(detailMsg.created_at).toLocaleString("es-CL")}</span>
                {detailMsg.read_at && <span>Leído: {new Date(detailMsg.read_at).toLocaleString("es-CL")}</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}