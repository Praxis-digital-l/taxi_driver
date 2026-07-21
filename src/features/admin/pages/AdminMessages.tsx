import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { MessageSquare, Pencil, Trash2, Send } from "lucide-react";

export default function AdminMessages() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [conductors, setConductors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const [detailMsg, setDetailMsg] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editMsg, setEditMsg] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteMsg, setDeleteMsg] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const OLD_STATUSES = ["pendiente", "en_proceso", "completado"];

  const load = async () => {
    const [msgRes, condRes] = await Promise.all([
      supabase.from("messages")
        .select("*, receiver:profiles!messages_receiver_id_fkey(full_name), sender:profiles!messages_sender_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("id, full_name, email").eq("role", "conductor").order("full_name"),
    ]);
    let data = msgRes.data || [];
    const toMigrate = data.filter((m: any) => OLD_STATUSES.includes(m.status));
    if (toMigrate.length > 0) {
      await Promise.all(toMigrate.map((m: any) => supabase.from("messages").update({ status: "enviado" }).eq("id", m.id)));
      data = data.map((m: any) => OLD_STATUSES.includes(m.status) ? { ...m, status: "enviado" } : m);
    }
    setMessages(data);
    setConductors(condRes.data || []);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const content = newMessage.trim();
    if (!content) {
      toast({ title: "Error", description: "El mensaje no puede estar vacío.", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("messages").insert({
      sender_id: profile.id,
      receiver_id: form.get("receiver_id") as string,
      content,
      status: "enviado",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensaje enviado" });
      setNewMessage("");
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editMsg) return;
    setEditLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from("messages").update({
      content: (form.get("content") as string).trim(),
      receiver_id: form.get("receiver_id") as string,
    }).eq("id", editMsg.id);
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensaje actualizado" });
      setEditOpen(false);
      load();
    }
    setEditLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteMsg) return;
    setDeleteLoading(true);
    const { error } = await supabase.from("messages").delete().eq("id", deleteMsg.id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensaje eliminado" });
      setDeleteOpen(false);
      if (detailMsg?.id === deleteMsg.id) setDetailOpen(false);
      load();
    }
    setDeleteLoading(false);
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
                <Label>Mensaje *</Label>
                <Textarea name="content" required placeholder="Escribe tu mensaje al conductor..." maxLength={500} rows={4} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <p className="text-xs text-muted-foreground text-right">{newMessage.length}/500</p>
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
            <Card key={msg.id} className="stat-card overflow-hidden cursor-pointer" onClick={() => { setDetailMsg(msg); setDetailOpen(true); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 max-w-full overflow-hidden">
                  <div className="flex-1 min-w-0 max-w-full">
                    <p className="text-xs text-muted-foreground break-words">
                      Para: <span className="font-medium text-foreground">{msg.receiver?.full_name}</span>
                      {" • De: "}{msg.sender?.full_name}
                    </p>
                    <p className="text-sm mt-1.5 leading-relaxed break-all whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={msg.status} />
                    <button onClick={() => { setEditMsg(msg); setEditOpen(true); }} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { setDeleteMsg(msg); setDeleteOpen(true); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive" /></button>
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
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="font-heading">Detalle del Mensaje</DialogTitle>
            <div className="flex items-center gap-1">
              {detailMsg && (
                <>
                  <button onClick={() => { setDetailOpen(false); setEditMsg(detailMsg); setEditOpen(true); }} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { setDetailOpen(false); setDeleteMsg(detailMsg); setDeleteOpen(true); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </>
              )}
            </div>
          </DialogHeader>
          {detailMsg && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">De:</span><p className="font-medium truncate">{detailMsg.sender?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Para:</span><p className="font-medium truncate">{detailMsg.receiver?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p><StatusBadge status={detailMsg.status} /></p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Fecha:</span><p className="font-medium truncate">{new Date(detailMsg.created_at).toLocaleString("es-CL")}</p></div>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground block mb-1">Mensaje:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                  {detailMsg.content || "Sin contenido"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Editar Mensaje</DialogTitle></DialogHeader>
          {editMsg && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Conductor destinatario</Label>
                <Select name="receiver_id" defaultValue={editMsg.receiver_id}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar conductor" /></SelectTrigger>
                  <SelectContent>
                    {conductors.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea name="content" required maxLength={1000} rows={4} defaultValue={editMsg.content} className="resize-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={editLoading}>{editLoading ? "Guardando..." : "Guardar Cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el mensaje para {deleteMsg?.receiver?.full_name ?? "el destinatario"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive hover:bg-destructive/90">
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
