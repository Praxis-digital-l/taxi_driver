import { ClipboardList, Banknote, Cog, Fuel, HandCoins, Palmtree, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeRequestTypeName } from "@/lib/requestPriority";

const TYPE_STYLES: Record<string, { icon: LucideIcon; className: string }> = {
  combustible: { icon: Fuel, className: "bg-warning/10 text-warning" },
  repuestos: { icon: Cog, className: "bg-info/10 text-info" },
  mantencion: { icon: Wrench, className: "bg-blue-500/10 text-blue-600" },
  vacaciones: { icon: Palmtree, className: "bg-teal-500/10 text-teal-600" },
  prestamo: { icon: HandCoins, className: "bg-violet-500/10 text-violet-600" },
  anticipo: { icon: Banknote, className: "bg-sky-500/10 text-sky-600" },
};

interface RequestTypeIconProps {
  typeName?: string | null;
  className?: string;
}

export default function RequestTypeIcon({ typeName, className }: RequestTypeIconProps) {
  const style = TYPE_STYLES[normalizeRequestTypeName(typeName)] ?? { icon: ClipboardList, className: "bg-primary/10 text-primary" };
  const Icon = style.icon;

  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", style.className, className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}