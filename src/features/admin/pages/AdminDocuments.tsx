import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { FileText, Download, Eye, AlertCircle, Search } from "lucide-react";
import { fetchAllDocuments, fetchDocumentTypes, type AdminDocument } from "@/features/admin/services/adminDocumentsService";
import { formatMontoInput } from "@/lib/rendimientoActivos";
import { downloadDocumentFile } from "@/shared/utils/storageFiles";
import DocumentPreviewDialog from "@/features/admin/components/DocumentPreviewDialog";
import { requiresExpirationDate } from "@/lib/documentRules";

export default function AdminDocuments() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewDocumentType, setPreviewDocumentType] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [docs, types] = await Promise.all([
          fetchAllDocuments(),
          fetchDocumentTypes(),
        ]);
        setDocuments(docs);
        setDocumentTypes(types);
      } catch (error) {
        toast({
          title: "Error al cargar documentos",
          description: error instanceof Error ? error.message : "No fue posible cargar los documentos",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return documents.filter((doc) => {
      if (filterType !== "all" && doc.document_types?.name !== filterType) return false;
      if (!q) return true;
      return (
        doc.document_types?.name?.toLowerCase().includes(q) ||
        doc.profiles?.full_name?.toLowerCase().includes(q) ||
        doc.vehicles?.license_plate?.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q)
      );
    });
  }, [documents, search, filterType]);

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 86400000;
  };

  const handleDownload = async (fileKey: string) => {
    try {
      await downloadDocumentFile(fileKey);
    } catch (error) {
      toast({
        title: "No se pudo descargar",
        description: error instanceof Error ? error.message : "Error descargando archivo",
        variant: "destructive",
      });
    }
  };

  const getDefaultFileName = (fileKey: string) => {
    const segments = fileKey.split("/");
    return segments[segments.length - 1] || "archivo";
  };

  const openPreview = (fileKey: string, documentType: string) => {
    setPreviewKey(fileKey);
    setPreviewFileName(getDefaultFileName(fileKey));
    setPreviewDocumentType(documentType);
  };

  return (
    <div>
      <PageHeader title="Documentos" description="Todos los documentos registrados">
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
          <div className="relative flex-1 min-w-[10rem] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-full sm:w-48 text-sm"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {documentTypes.map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No se encontraron documentos</p>
          <p className="text-xs mt-1">Intenta ajustar los filtros de búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            Mostrando {filtered.length} de {documents.length} documento(s)
          </p>
          {filtered.map((document) => {
            const needsExp = requiresExpirationDate(document.document_types?.name);
            return (
              <Card
                key={document.id}
                className="stat-card cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/50"
                onClick={() => openPreview(document.file_key, document.document_types?.name || "Documento")}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{document.document_types?.name}</p>
                      {needsExp && isExpiringSoon(document.expiration_date) && (
                        <span className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" />Por vencer
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all whitespace-pre-wrap">
                      {document.profiles?.full_name || "Sin conductor"}
                      {document.vehicles?.license_plate ? ` • ${document.vehicles.license_plate}` : ""}
                      {document.description ? ` • ${document.description}` : ""}
                    </p>
                    {needsExp && document.expiration_date && (
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(document.expiration_date).toLocaleDateString("es-CL")}
                      </p>
                    )}
                    {Number(document.amount) > 0 && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Monto: {formatMontoInput(Number(document.amount))}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); openPreview(document.file_key, document.document_types?.name || "Documento"); }}
                      title="Vista previa"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDownload(document.file_key); }}
                      title="Descargar documento"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentPreviewDialog
        open={previewKey !== null}
        onOpenChange={(open) => { if (!open) setPreviewKey(null); }}
        fileKey={previewKey ?? ""}
        fileName={previewFileName}
        documentType={previewDocumentType}
      />
    </div>
  );
}
