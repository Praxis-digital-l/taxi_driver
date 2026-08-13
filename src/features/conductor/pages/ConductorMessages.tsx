import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { MessageSquare } from "lucide-react";
import { useLocation } from "react-router-dom";

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
  const statusForConductor = (s: string) => s === "enviado" ? "pendiente" : "visto";

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });

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
          {messages.map((msg) => (
            <Card key={msg.id} className="stat-card overflow-hidden cursor-pointer" onClick={() => openDetail(msg)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 max-w-full overflow-hidden">
                  <div className="flex-1 min-w-0 max-w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-muted-foreground break-all">De: {msg.sender?.full_name || "Administrador"}</p>
                      <StatusBadge status={statusForConductor(msg.status)} />
                    </div>
                    <p className="text-sm mt-2 leading-relaxed break-all whitespace-pre-wrap line-clamp-2">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDateTime(msg.created_at)}
                    </p>
                    {msg.status === "visto" && msg.read_at && (
                      <p className="text-xs text-accent mt-1">Visto el {formatDateTime(msg.read_at)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Detalle del Mensaje</DialogTitle>
          </DialogHeader>
          {detailMsg && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">De:</span><p className="font-medium truncate">{detailMsg.sender?.full_name ?? "Administrador"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p><StatusBadge status={statusForConductor(detailMsg.status)} /></p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Fecha:</span><p className="font-medium truncate">{new Date(detailMsg.created_at).toLocaleString("es-CL")}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Visto:</span><p className="font-medium truncate">{detailMsg.read_at ? new Date(detailMsg.read_at).toLocaleString("es-CL") : "—"}</p></div>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground block mb-1">Mensaje:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                  {detailMsg.content || "Sin contenido"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
