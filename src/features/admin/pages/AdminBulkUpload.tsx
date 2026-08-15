import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createConductorProfile } from "@/features/admin/services/adminConductoresService";
import { createVehicle, assignConductorToVehicle } from "@/features/admin/services/adminVehiclesService";
import * as XLSX from "xlsx";

type Row = Record<string, string>;

type ImportResult = {
  row: number;
  status: "ok" | "error";
  message: string;
};

type Field =
  | "nombres"
  | "apellido_paterno"
  | "apellido_materno"
  | "email"
  | "phone"
  | "rut"
  | "license_plate"
  | "make"
  | "model"
  | "year"
  | "color";

const FIELDS: Field[] = [
  "nombres",
  "apellido_paterno",
  "apellido_materno",
  "email",
  "phone",
  "rut",
  "license_plate",
  "make",
  "model",
  "year",
  "color",
];

const HEADER_ALIASES: Record<Field, string[]> = {
  nombres: ["nombres", "nombre", "name"],
  apellido_paterno: ["apellido paterno", "apellidopaterno", "paterno"],
  apellido_materno: ["apellido materno", "apellidomaterno", "materno"],
  email: ["email", "correo", "correo electronico"],
  phone: ["phone", "telefono", "telefonoorigen", "celular", "celularconductor"],
  rut: ["rut"],
  license_plate: ["license plate", "licenseplate", "patente", "matricula", "patentevehiculo"],
  make: ["make", "marca"],
  model: ["model", "modelo"],
  year: ["year", "ano", "año"],
  color: ["color"],
};

const TEMPLATE_HEADERS = ["Nombres", "Apellido Paterno", "Apellido Materno", "Email", "Teléfono", "RUT", "Patente", "Marca", "Modelo", "Año", "Color"];

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

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

    const values = splitLine(line, delimiter).map((v) => v.replace(/^"|"$/g, ""));

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

function buildHeaderMap(row: Row): Record<Field, string> | null {
  const aliasMap: Record<string, Field> = {};
  FIELDS.forEach((field) => {
    HEADER_ALIASES[field].forEach((alias) => {
      aliasMap[normalizeHeader(alias)] = field;
    });
  });

  const mapping: Partial<Record<Field, string>> = {};
  Object.keys(row).forEach((header) => {
    const field = aliasMap[normalizeHeader(header)];
    if (field && !mapping[field]) mapping[field] = header;
  });

  const required: Field[] = ["nombres", "apellido_paterno", "email", "rut"];
  for (const field of required) {
    if (!mapping[field]) return null;
  }
  return mapping as Record<Field, string>;
}

function generateTemplate() {
  const sample = ["Carlos", "Muñoz", "Rojas", "carlos@ejemplo.cl", "+56912345678", "12.345.678-5", "ABCD-12", "Toyota", "Hiace", "2023", "Blanco"];
  return [TEMPLATE_HEADERS.join(","), sample.join(",")].join("\n");
}

export default function AdminBulkUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const bom = "\uFEFF";
    const blob = new Blob([bom + generateTemplate()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_carga_datos.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImport = async () => {
    if (previewRows.length === 0) return;
    const headerMap = buildHeaderMap(previewRows[0]);
    if (!headerMap) {
      toast({
        title: "Error de formato",
        description: `Las columnas del archivo no coinciden con las esperadas. Usa: ${TEMPLATE_HEADERS.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResults([]);
    setShowResults(true);

    const resultList: ImportResult[] = [];
    let okCount = 0;
    let errorCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      const rowKey = i + 2;
      try {
        const nombres = (row[headerMap.nombres] || "").trim();
        const apellidoPaterno = (row[headerMap.apellido_paterno] || "").trim();
        const apellidoMaterno = (row[headerMap.apellido_materno] || "").trim();
        const email = (row[headerMap.email] || "").trim();
        const phone = (row[headerMap.phone] || "").trim();
        const rut = (row[headerMap.rut] || "").trim();

        if (!nombres || !apellidoPaterno || !email || !rut) {
          throw new Error("Faltan campos requeridos: Nombres, Apellido Paterno, Email, RUT");
        }

        const conductorId = await createConductorProfile({
          nombres,
          apellidoPaterno,
          apellidoMaterno,
          email,
          phone,
          rut,
        });

        const licensePlate = (row[headerMap.license_plate] || "").trim();
        if (licensePlate) {
          const vehicleId = await createVehicle({
            licensePlate,
            make: (row[headerMap.make] || "").trim(),
            model: (row[headerMap.model] || "").trim(),
            year: row[headerMap.year] ? Number.parseInt(row[headerMap.year], 10) : null,
            color: (row[headerMap.color] || "").trim(),
          });
          if (vehicleId) {
            await assignConductorToVehicle(vehicleId, conductorId);
          }
        }

        resultList.push({ row: rowKey, status: "ok", message: "Conductor y vehículo importados" });
        okCount += 1;
      } catch (err) {
        resultList.push({ row: rowKey, status: "error", message: extractErrorMessage(err) });
        errorCount += 1;
      }
    }

    setResults(resultList);
    setImporting(false);

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
      <PageHeader title="Carga Masiva" description="Sube conductores y vehículos en un solo archivo CSV o Excel">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1.5 h-4 w-4" />
          Descargar Plantilla
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subir Conductores y Vehículos</CardTitle>
          <CardDescription>
            El archivo (CSV o Excel) debe contener una fila por conductor con los datos solicitados en español:
            Nombres, Apellido Paterno, Apellido Materno, Email, Teléfono, RUT, Patente, Marca, Modelo, Año, Color.
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

      {previewRows.length > 0 && buildHeaderMap(previewRows[0]) && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Previsualización</CardTitle>
              <CardDescription>{previewRows.length} registros detectados</CardDescription>
            </div>
            <span className="text-xs text-muted-foreground max-w-md text-right">
              Se importarán los datos del conductor y del vehículo de cada fila. La contraseña se gestiona
              por separado en la base de datos.
            </span>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded-md border">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {TEMPLATE_HEADERS.map((key) => (
                        <TableHead key={key} className="text-xs uppercase">{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => {
                      const map = buildHeaderMap(row) as Record<Field, string>;
                      return (
                        <TableRow key={i}>
                          {FIELDS.map((field) => (
                            <TableCell key={field} className="text-sm">{row[map[field]] ?? ""}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
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

      {previewRows.length > 0 && !buildHeaderMap(previewRows[0]) && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Las columnas del archivo no son válidas. Usa:{" "}
              {TEMPLATE_HEADERS.join(", ")}. Descarga la plantilla para ver el formato.
            </p>
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