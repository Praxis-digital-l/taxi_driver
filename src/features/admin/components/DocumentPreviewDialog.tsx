import { useState, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createDocumentSignedUrl } from "@/shared/utils/storageFiles";
import { Download, Loader2, AlertCircle, FileText, ZoomIn, ZoomOut } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileKey: string;
  fileName: string;
  documentType: string;
}

function getFileExtension(fileKey: string): string {
  const segments = fileKey.split("/");
  const name = segments[segments.length - 1] || "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return name.slice(dotIndex + 1).toLowerCase();
}

function isImageExtension(ext: string): boolean {
  return ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
}

function isPdfExtension(ext: string): boolean {
  return ext === "pdf";
}

export default function DocumentPreviewDialog({
  open,
  onOpenChange,
  fileKey,
  fileName,
  documentType,
}: DocumentPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadUrl = async () => {
      setLoading(true);
      setError(null);
      setPageNumber(1);
      setScale(1);
      setNumPages(null);
      try {
        const url = await createDocumentSignedUrl(fileKey, 300);
        if (!cancelled) setSignedUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar documento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadUrl();
    return () => { cancelled = true; };
  }, [open, fileKey]);

  const handleDownload = useCallback(async () => {
    if (!signedUrl) return;
    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [signedUrl, fileName]);

  const ext = getFileExtension(fileKey);
  const isImage = isImageExtension(ext);
  const isPdf = isPdfExtension(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <DialogTitle className="text-base flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{documentType}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {isPdf && signedUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3rem] text-center tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale((s) => Math.min(2, s + 0.25))}
                  disabled={scale >= 2}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
              <Download className="h-4 w-4 mr-1" />
              Descargar
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex items-start justify-center bg-muted/30 rounded-lg p-4 min-h-[400px]">
          {loading && (
            <div className="flex items-center justify-center w-full h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center w-full h-64 gap-2 text-destructive">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && signedUrl && isImage && (
            <img
              src={signedUrl}
              alt={documentType}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}

          {!loading && !error && signedUrl && isPdf && (
            <div className="flex flex-col items-center">
              <Document
                file={signedUrl}
                onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                loading={
                  <div className="flex items-center justify-center w-full h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center w-full h-64 gap-2 text-destructive">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">Error al cargar el PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </Document>
              {numPages !== null && numPages > 1 && (
                <div className="flex items-center gap-3 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {pageNumber} de {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && signedUrl && !isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center w-full h-64 gap-2 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Vista previa no disponible para este formato</p>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Descargar archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
