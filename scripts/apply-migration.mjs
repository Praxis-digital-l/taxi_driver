import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const MIGRATION_FILE = resolve(__dirname, "../", process.argv[2] || "supabase/add_worker_id.sql");

async function main() {
  const migrationName = process.argv[2] || "supabase/add_worker_id.sql";
  console.log(`\n=== Migración: ${migrationName} ===\n`);

  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    console.error("No se encontró .env en la raíz del proyecto.");
    process.exit(1);
  }

  const envContent = readFileSync(envPath, "utf-8");
  const env = Object.fromEntries(
    envContent
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      }),
  );

  const supabaseUrl = env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("VITE_SUPABASE_URL no encontrado en .env");
    process.exit(1);
  }

  let serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.log("No se encontró SUPABASE_SERVICE_ROLE_KEY en .env");
    serviceRoleKey = await ask(
      "Ingresa la Service Role Key (desde Supabase Dashboard > Settings > API): ",
    );
    if (!serviceRoleKey.trim()) {
      console.log("\n--- Instrucciones manuales ---");
      console.log("1. Abre https://supabase.com/dashboard/project/ywcgtwlhievzgflmncsq");
      console.log("2. Ve a SQL Editor");
      console.log(`3. Copia y pega el contenido de: ${migrationName}`);
      console.log("4. Ejecuta la consulta\n");
      process.exit(0);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const sql = readFileSync(MIGRATION_FILE, "utf-8");

  // Try via rpc if a pg_dump exec function exists
  console.log("Ejecutando migración...");
  const { error } = await supabase.rpc("exec_sql", { query: sql }).maybeSingle();

  if (error) {
    // Fallback: direct REST API with service role
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
    } catch (e) {
      console.error("\nNo se pudo ejecutar la migración automáticamente.");
      console.error(e.message);
      console.log("\n--- Instrucciones manuales ---");
      console.log("1. Abre https://supabase.com/dashboard/project/ywcgtwlhievzgflmncsq");
      console.log("2. Ve a SQL Editor");
      console.log(`3. Copia y pega el contenido de: ${migrationName}`);
      console.log("4. Ejecuta la consulta\n");
      process.exit(1);
    }
  }

  console.log("Migración ejecutada exitosamente.");
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
