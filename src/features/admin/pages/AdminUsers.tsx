import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCog, UserRound } from "lucide-react";

type ProfileRow = Tables<"profiles">;
type AppRole = ProfileRow["role"];

const ROLE_OPTIONS: AppRole[] = ["conductor", "admin", "super_admin"];

const ROLE_LABEL: Record<AppRole, string> = {
  conductor: "Conductor",
  admin: "Administrador",
  super_admin: "Super Admin",
};

const roleBadgeClass: Record<AppRole, string> = {
  conductor: "bg-muted text-muted-foreground",
  admin: "bg-primary/10 text-primary",
  super_admin: "bg-accent/10 text-accent",
};

export default function AdminUsers() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, phone, role, created_at, updated_at")
      .order("full_name", { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setUsers([]);
    } else {
      setUsers(data || []);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) =>
      user.full_name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  const updateRole = async (target: ProfileRow, nextRole: AppRole) => {
    if (!profile) return;

    if (target.id === profile.id && nextRole !== "super_admin") {
      toast({
        title: "Acción bloqueada",
        description: "No puedes quitarte el rol de super admin desde esta pantalla.",
        variant: "destructive",
      });
      return;
    }

    setSavingUserId(target.id);
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", target.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setUsers((prev) => prev.map((user) => (user.id === target.id ? { ...user, role: nextRole } : user)));
      toast({ title: "Rol actualizado", description: `${target.full_name} ahora es ${ROLE_LABEL[nextRole]}.` });
    }

    setSavingUserId(null);
  };

  return (
    <div>
      <PageHeader
        title="Gestión de Usuarios"
        description="Solo super admin: promoción/democión de roles"
      />

      <Card className="mb-4">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Para crear un nuevo administrador: primero registra la cuenta en <span className="font-medium text-foreground">/auth</span> y luego cámbiale el rol aquí.
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Buscar Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por nombre o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={120}
          />
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Cargando usuarios...
          </CardContent>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay usuarios que coincidan con la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredUsers.map((user) => {
            const isMe = user.id === profile?.id;
            const isSaving = savingUserId === user.id;

            return (
              <Card key={user.id} className="stat-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{user.full_name || "Sin nombre"}</p>
                        <Badge variant="secondary" className={roleBadgeClass[user.role]}>
                          {ROLE_LABEL[user.role]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email || "Sin correo"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Tel: {user.phone || "-"}</p>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Alta: {new Date(user.created_at).toLocaleDateString("es-CL")}
                      </p>
                    </div>

                    <div className="w-full sm:w-[220px] space-y-2">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {user.role === "super_admin" ? <Shield className="h-3.5 w-3.5" /> : <UserCog className="h-3.5 w-3.5" />}
                        Rol del usuario
                      </div>
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateRole(user, value as AppRole)}
                        disabled={isMe || isSaving}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} value={role} className="text-xs">
                              {ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isMe && (
                        <p className="text-[11px] text-muted-foreground">
                          Tu propio rol no se edita desde esta vista.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
