import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { Trophy, Sparkles, Medal, Award, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  className?: string;
};

export function ConductorDelMesCard({ editable = false, className }: ConductorDelMesCardProps) {
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

  const activeMonth = conductor?.month ?? month;
  const activeYear = conductor?.year ?? year;
  const monthLabel = `${MONTH_NAMES[activeMonth - 1]} ${activeYear}`;

  const selectedCandidate = candidates.find((c) => c.id === selectedId) ?? null;
  const displayDriver =
    editable && selectedCandidate
      ? { full_name: selectedCandidate.full_name, photo_url: selectedCandidate.photo_url, worker_id: selectedCandidate.worker_id }
      : conductor?.conductor;

  return (
    <Card className={cn("relative overflow-hidden border border-border/80 shadow-sm bg-card hover:shadow-md transition-all flex flex-col justify-between", className)}>
      {/* Decorative ambient gradients */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-500/10 dark:bg-amber-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />

      <CardContent className="relative p-5 flex flex-col justify-between h-full gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-heading text-sm font-bold tracking-tight text-foreground">Conductor del Mes</h4>
              <p className="text-[11px] text-muted-foreground leading-none">Reconocimiento destacado</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {monthLabel}
          </Badge>
        </div>

        {/* Centerpiece Spotlight */}
        {loading ? (
          <div className="my-auto py-6 flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-4 w-36 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ) : displayDriver ? (
          <div className="my-auto py-3 flex flex-col items-center text-center">
            <div className="relative mb-3 group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 opacity-30 blur group-hover:opacity-50 transition-opacity" />
              <ConductorAvatar
                fullName={displayDriver.full_name}
                photoUrl={displayDriver.photo_url}
                className="relative h-20 w-20 ring-4 ring-amber-500/40 shadow-lg shadow-amber-500/20"
              />
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-md ring-2 ring-card">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 mb-1.5 shadow-sm">
              <Medal className="h-3 w-3 text-amber-500" />
              Destacado de {MONTH_NAMES[activeMonth - 1]}
            </div>

            <h3 className="text-base font-bold font-heading text-foreground tracking-tight max-w-full px-2">
              {displayDriver.full_name ?? "Conductor"}
            </h3>
            
            {displayDriver.worker_id && (
              <p className="text-[11px] text-muted-foreground font-data mt-0.5">
                Código: {displayDriver.worker_id}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2 max-w-[240px] leading-relaxed">
              Reconocido por su compromiso, puntualidad y excelencia en el servicio.
            </p>
          </div>
        ) : (
          <div className="my-auto py-6 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-dashed border-amber-500/30 mb-3 shadow-sm">
              <Trophy className="h-7 w-7 opacity-80" />
            </div>
            <p className="text-sm font-semibold text-foreground">Sin conductor seleccionado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
              {editable
                ? "Elige al conductor destacado para otorgarle el reconocimiento de este mes."
                : "Aún no se ha asignado el conductor destacado para este mes."}
            </p>
          </div>
        )}

        {/* Editable form footer */}
        {editable && (
          <div className="pt-3 border-t border-border/50 space-y-2 shrink-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {displayDriver ? "Cambiar conductor del mes:" : "Asignar conductor del mes:"}
            </p>
            <div className="flex items-center gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Elegir conductor…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay conductores disponibles</div>
                  ) : (
                    candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id} className="text-xs">
                        {`${candidate.full_name ?? "Sin nombre"}${
                          candidate.worker_id ? ` (${candidate.worker_id})` : ""
                        }`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" onClick={handleSave} disabled={saving || !selectedId}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}