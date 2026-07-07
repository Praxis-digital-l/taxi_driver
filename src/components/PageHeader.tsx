import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // Slot para acciones (botones, filtros)
}

/** Encabezado reutilizable para páginas internas */
export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 mt-2 sm:mt-0">{children}</div>}
    </div>
  );
}
