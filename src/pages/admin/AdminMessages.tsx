import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setMessages(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mensajes</h1>
        <p className="text-muted-foreground">Sistema de mensajería de la plataforma</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Mensajes</CardTitle>
          <CardDescription>Últimos 20 mensajes del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : messages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.id.substring(0, 8)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        m.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {m.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No hay mensajes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
