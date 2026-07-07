import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { MessageSquare } from "lucide-react";

export default function ConductorMessages() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Array<{
    id: string;
    status: string;
    content: string;
    created_at: string;
    sender?: { full_name?: string | null } | null;
  }>>([]);

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

    setMessages(data || []);
  }, [profile, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    if (!profile) return;

    const { error } = await supabase
      .from("messages")
      .update({ status, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("receiver_id", profile.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `Estado actualizado: ${status.replace("_", " ")}` });
    load();
  };

  return (
    <div>
      <PageHeader title="Mensajes" description={`${messages.length} mensaje(s) recibido(s)`} />

      {messages.length === 0 ? (
        <Card><CardContent className="empty-state"><MessageSquare /><p>No tienes mensajes.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {messages.map((msg) => (
            <Card key={msg.id} className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-muted-foreground">De: {msg.sender?.full_name || "Administrador"}</p>
                      <StatusBadge status={msg.status} />
                    </div>
                    <p className="text-sm mt-2 leading-relaxed">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="w-[150px] shrink-0">
                    <Select value={msg.status} onValueChange={(value) => updateStatus(msg.id, value)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
                        <SelectItem value="completado">Completado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
