import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge, { MESSAGE_STATUSES } from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { MessageSquare, Plus, Send } from "lucide-react";

export default function AdminMessages() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [conductors, setConductors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [msgRes, condRes] = await Promise.all([
      supabase.from("messages")
        .select("*, receiver:profiles!messages_receiver_id_fkey(full_name), sender:profiles!messages_sender_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("id, full_name, email").eq("role", "conductor").order("full_name"),
    ]);
    setMessages(msgRes.data || []);
    setConductors(condRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const content = (form.get("content") as string).trim();
    if (!content) {
      toast({ title: "Error", description: "El mensaje no puede estar vacío.", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("messages").insert({
      sender_id: profile.id,
      receiver_id: form.get("receiver_id") as string,
      content,
      status: (form.get("status") as string) || "pendiente",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensaje enviado" });
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("messages").update({ status }).eq("id", id);
    toast({ title: `Estado: ${status.replace("_", " ")}` });
    load();
  };

  return (
    <div>
      <PageHeader title="Mensajes a Conductores" description={`${messages.length} mensaje(s)`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Send className="mr-1.5 h-4 w-4" />Nuevo Mensaje</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Enviar Mensaje</DialogTitle></DialogHeader>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-2">
                <Label>Conductor destinatario *</Label>
                <Select name="receiver_id" required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar conductor" /></SelectTrigger>
                  <SelectContent>
                    {conductors.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado inicial</Label>
                <Select name="status" defaultValue="pendiente">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESSAGE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensaje *</Label>
                <Textarea name="content" required placeholder="Escribe tu mensaje al conductor..." maxLength={1000} rows={4} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Mensaje"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {messages.length === 0 ? (
        <Card><CardContent className="empty-state"><MessageSquare /><p>No hay mensajes enviados.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {messages.map((msg: any) => (
            <Card key={msg.id} className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-muted-foreground">
                      Para: <span className="font-medium text-foreground">{msg.receiver?.full_name}</span>
                      {" • De: "}{msg.sender?.full_name}
                    </p>
                    <p className="text-sm mt-1.5 leading-relaxed">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={msg.status} />
                    <Select value={msg.status} onValueChange={(v) => updateStatus(msg.id, v)}>
                      <SelectTrigger className="w-[120px] h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESSAGE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                        ))}
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
