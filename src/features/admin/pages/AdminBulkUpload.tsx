import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createConductor } from "@/features/admin/services/adminConductoresService";
import { createVehicle } from "@/features/admin/services/adminVehiclesService";
import * as XLSX from "xlsx";

type Row = Record<string, string>;

type ImportResult = {
  row: number;
  status: "ok" | "error";
  message: string;
};

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount >= commaCount ? ";" : ",";
}

function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length < 2) return { headers: [], rows: [] };

  const headerLine = rawLines[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = splitLine(headerLine, delimiter)
    .map((h) => h.trim().replace(/^"|"$/g, ""))
    .filter((h) => h.length > 0);

  if (headers.length === 0) return { headers: [], rows: [] };

  const rows: Row[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (line.length === 0) continue;

    const values = splitLine(line, delimiter)
      .map((v) => v.replace(/^"|"$/g, ""));

    const row: Row = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = values[j] ?? "";
      row[headers[j]] = val;
      if (val.length > 0) hasData = true;
    }
    if (hasData) rows.push(row);
  }

  return { headers, rows };
}

function parseExcel(data: ArrayBuffer): { headers: string[]; rows: Row[] } {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  if (json.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]);
  return { headers, rows: json };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      return parsed.error || parsed.message || err.message;
    } catch {
      return err.message;
    }
  }
  return "Error desconocido";
}
function generateConductorTemplate() {
  const headers = ["nombres", "apellido_paterno", "apellido_materno", "email", "phone", "rut", "password"];
  const sample = ["Carlos", "Muñoz", "Rojas", "carlos@ejemplo.cl", "+56912345678", "12.345.678-5", "clave123"];
  return [headers.join(","), sample.join(",")].join("\n");
}

function generateVehicleTemplate() {
  const headers = ["license_plate", "make", "model", "year", "color"];
  const sample = ["ABCD-12", "Toyota", "Hiace", "2023", "Blanco"];
  return [headers.join(","), sample.join(",")].join("\n");
}

export default function AdminBulkUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("conductores");
  const [previewRows, setPreviewRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowResults(false);
    setResults([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result as ArrayBuffer;

      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const { rows } = parseExcel(data);
        setPreviewRows(rows);
      } else {
        const decoder = new TextDecoder("utf-8");
        let text = decoder.decode(data);
        if (text.includes("\uFFFD")) {
          const latinDecoder = new TextDecoder("latin1");
          text = latinDecoder.decode(data);
        }
        text = text.replace(/^\uFEFF/, "");
        const { rows } = parseCsv(text);
        setPreviewRows(rows);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const csv = activeTab === "conductores" ? generateConductorTemplate() : generateVehicleTemplate();
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `plantilla_${activeTab}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImport = async () => {
    if (previewRows.length === 0) return;
    setImporting(true);
    setResults([]);
    setShowResults(true);

    const resultList: ImportResult[] = [];

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      try {
        if (activeTab === "conductores") {
          if (!row.email || !row.password || !row.nombres || !row.apellido_paterno) {
            throw new Error("Faltan campos requeridos: email, password, nombres, apellido_paterno");
          }
          await createConductor({
            nombres: row.nombres.trim(),
            apellidoPaterno: row.apellido_paterno.trim(),
            apellidoMaterno: (row.apellido_materno || "").trim(),
            email: row.email.trim(),
            phone: (row.phone || "").trim(),
            rut: (row.rut || "").trim(),
            password: row.password,
          });
          resultList.push({ row: i + 2, status: "ok", message: "Conductor creado" });
        } else {
          if (!row.license_plate) {
            throw new Error("Falta campo requerido: license_plate");
          }
          await createVehicle({
            licensePlate: row.license_plate.trim(),
            make: (row.make || "").trim(),
            model: (row.model || "").trim(),
            year: row.year ? Number.parseInt(row.year, 10) : null,
            color: (row.color || "").trim(),
          });
          resultList.push({ row: i + 2, status: "ok", message: "Vehículo creado" });
        }
      } catch (err) {
        resultList.push({
          row: i + 2,
          status: "error",
          message: extractErrorMessage(err),
        });
      }
    }

    setResults(resultList);
    setImporting(false);

    const okCount = resultList.filter((r) => r.status === "ok").length;
    const errorCount = resultList.filter((r) => r.status === "error").length;
    toast({
      title: errorCount > 0 ? "Importación completada con errores" : "Importación exitosa",
      description: `${okCount} registros importados, ${errorCount} errores`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const resetUpload = () => {
    setPreviewRows([]);
    setFileName("");
    setResults([]);
    setShowResults(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Carga Masiva" description="Sube conductores y vehículos mediante archivos CSV o Excel">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1.5 h-4 w-4" />
          Descargar Plantilla
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetUpload(); }}>
        <TabsList>
          <TabsTrigger value="conductores">Conductores</TabsTrigger>
          <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
        </TabsList>

        <TabsContent value="conductores" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subir Conductores</CardTitle>
              <CardDescription>
                El archivo (CSV o Excel) debe contener las columnas: nombres, apellido_paterno, apellido_materno, email, phone, rut, password.
                Usa el botón "Descargar Plantilla" para ver el formato esperado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="text-sm w-full sm:w-auto file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {fileName && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1 truncate max-w-full">
                    <FileSpreadsheet className="h-4 w-4 shrink-0" /> {fileName}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehiculos" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subir Vehículos</CardTitle>
              <CardDescription>
                El archivo (CSV o Excel) debe contener las columnas: license_plate, make, model, year, color.
                Usa el botón "Descargar Plantilla" para ver el formato esperado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="text-sm w-full sm:w-auto file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {fileName && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1 truncate max-w-full">
                    <FileSpreadsheet className="h-4 w-4 shrink-0" /> {fileName}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {previewRows.length > 0 && !showResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previsualización</CardTitle>
            <CardDescription>{previewRows.length} registros detectados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded-md border">
              <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(previewRows[0]).map((key) => (
                      <TableHead key={key} className="text-xs uppercase">{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j} className="text-sm">{val}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {importing ? "Importando..." : "Importar Datos"}
              </Button>
              <Button variant="outline" onClick={resetUpload}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultados</CardTitle>
            <CardDescription>
              {results.filter((r) => r.status === "ok").length} exitosos,{" "}
              {results.filter((r) => r.status === "error").length} errores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded-md border">
              <div className="min-w-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead className="w-20">Estado</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-mono">{r.row}</TableCell>
                      <TableCell>
                        {r.status === "ok" ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" /> Error
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            <Button variant="outline" className="mt-4" onClick={resetUpload}>
              Subir otro archivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
