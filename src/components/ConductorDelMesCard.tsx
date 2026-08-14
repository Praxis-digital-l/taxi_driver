import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { Loader2, Trophy } from "lucide-react";
import {
  fetchConductorDelMes,
  fetchConductorCandidates,
  setConductorDelMes,
  type ConductorCandidate,
  type ConductorDelMes,
} from "@/features/admin/services/conductorDelMesService";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type ConductorDelMesCardProps = {
  editable?: boolean;
};

export function ConductorDelMesCard({ editable = false }: ConductorDelMesCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [conductor, setConductor] = useState<ConductorDelMes | null>(null);
  const [candidates, setCandidates] = useState<ConductorCandidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [monthly, candidateList] = await Promise.all([
          fetchConductorDelMes(month, year),
          editable ? fetchConductorCandidates() : Promise.resolve([]),
        ]);
        if (!active) return;
        setConductor(monthly);
        setCandidates(candidateList);
        setSelectedId(monthly?.conductor?.id ?? "");
      } catch (error) {
        if (!active) return;
        toast({
          title: "Error al cargar Conductor del Mes",
          description: error instanceof Error ? error.message : "No fue posible cargar los datos",
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [month, year, editable, toast, profile?.photo_url]);

  const handleSave = async () => {
    if (!selectedId || !profile) return;
    setSaving(true);
    try {
      await setConductorDelMes(selectedId, month, year, profile.id);
      const updated = await fetchConductorDelMes(month, year);
      setConductor(updated);
      setSelectedId(updated?.conductor?.id ?? "");
      toast({
        title: "Conductor del Mes actualizado",
        description: "La selección se guardó correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No fue posible guardar la selección",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const selectedCandidate = candidates.find((c) => c.id === selectedId) ?? null;
  const displayDriver =
    editable && selectedCandidate
      ? { full_name: selectedCandidate.full_name, photo_url: selectedCandidate.photo_url }
      : conductor?.conductor;

  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-4 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-primary/10" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Trophy className="h-4 w-4" />
            </span>
            <p className="font-heading text-sm font-semibold">Conductor del Mes</p>
            <Badge variant="secondary" className="ml-auto">{monthLabel}</Badge>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ) : displayDriver ? (
            <div className="mt-4 flex items-center gap-4">
              <ConductorAvatar
                fullName={displayDriver.full_name}
                photoUrl={displayDriver.photo_url}
                className="h-16 w-16 ring-2 ring-accent ring-offset-2"
              />
              <div className="min-w-0">
                <p className="text-lg font-bold font-heading leading-tight">
                  {displayDriver.full_name ?? "Conductor"}
                </p>
                <p className="text-xs text-muted-foreground">Destacado de {monthLabel}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-border ring-offset-2">
                <Trophy className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Aún no se ha elegido el conductor del mes</p>
                <p className="text-xs text-muted-foreground">El administrador puede destacar a un conductor.</p>
              </div>
            </div>
          )}

          {editable && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue placeholder="Seleccionar conductor…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay conductores disponibles</div>
                  ) : (
                    candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {`${candidate.full_name ?? "Sin nombre"}${
                          candidate.worker_id ? ` — ${candidate.worker_id}` : ""
                        }`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSave} disabled={saving || !selectedId}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}