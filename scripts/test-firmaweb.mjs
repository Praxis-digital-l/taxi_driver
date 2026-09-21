/**
 * Script de prueba de conexión real con FirmaWeb
 * Ejecución: node --env-file=.env scripts/test-firmaweb.mjs
 */

const env = process.env.FIRMAWEB_ENV || "dev";
const baseUrl =
  process.env.FIRMAWEB_BASE_URL ||
  (env === "prod"
    ? "https://sistema.firmaweb.app/apifw/v1"
    : "https://testing.firmaweb.app/apifw/v1");

const user = process.env.FIRMAWEB_USER;
const pass = process.env.FIRMAWEB_PASS;
let authBase64 = process.env.FIRMAWEB_AUTH_BASE64;

if (!authBase64 && user && pass) {
  authBase64 = Buffer.from(`${user}:${pass}`).toString("base64");
}

console.log("==================================================");
console.log(" DIAGNÓSTICO DE CONEXIÓN A FIRMAWEB");
console.log("==================================================");
console.log(`📡 Entorno:       ${env.toUpperCase()}`);
console.log(`🌐 URL Base:      ${baseUrl}`);
console.log(`👤 Usuario:       ${user ? user : "(no definido - usando authBase64)"}`);
console.log(`🔑 Auth Base64:   ${authBase64 ? authBase64.substring(0, 8) + "..." : "❌ NO CONFIGURADO"}`);
console.log("--------------------------------------------------\n");

if (!authBase64) {
  console.error("❌ ERROR: Faltan las credenciales en tu archivo .env");
  console.error("Por favor agrega:");
  console.error("FIRMAWEB_USER=tu_usuario");
  console.error("FIRMAWEB_PASS=tu_clave");
  console.error("o bien:");
  console.error("FIRMAWEB_AUTH_BASE64=tu_base64");
  process.exit(1);
}

async function runTest() {
  try {
    // 1. Probar POST /token
    console.log("⏳ 1. Solicitando Token de autenticación (/token)...");
    const tokenRes = await fetch(`${baseUrl}/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authBase64}`,
      },
    });

    const tokenData = await tokenRes.json();
    console.log(`   HTTP Status: ${tokenRes.status}`);
    console.log("   Respuesta API:", tokenData);

    if (tokenData.Estado !== 1) {
      console.error("\n❌ Error en autenticación:");
      if (tokenData.Estado === 93) {
        console.error("   -> Estado 93: 'No autorizado'. Revisa que tu usuario y contraseña sean los correctos.");
      } else if (tokenData.Estado === 429) {
        console.error("   -> Estado 429: 'Demasiados intentos'. Has superado el límite de 5 req/min en /token.");
      } else {
        console.error(`   -> Estado ${tokenData.Estado}: ${tokenData.Mensaje}`);
      }
      process.exit(1);
    }

    console.log("✅ Token obtenido exitosamente!");
    console.log(`   Token (primeros 20 caracteres): ${tokenData.Token.substring(0, 20)}...`);
    console.log(`   Expira en (timestamp Unix):    ${tokenData.Expira_en}`);

    const bearerToken = tokenData.Token;

    // 2. Probar POST /consultar_saldos
    console.log("\n⏳ 2. Consultando saldo de firmas disponibles (/consultar_saldos)...");
    const saldosRes = await fetch(`${baseUrl}/consultar_saldos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({}),
    });

    const saldosData = await saldosRes.json();
    console.log(`   HTTP Status: ${saldosRes.status}`);
    console.log("   Respuesta API:", saldosData);

    if (saldosData.Estado === 1) {
      console.log("\n🎉 CONEXIÓN EXITOSA Y OPERATIVA!");
      console.log(`   ✍️ Firmas Simples (FES) disponibles:   ${saldosData.fes_disponibles ?? 0}`);
      console.log(`   🔐 Firmas Avanzadas (FAO) disponibles: ${saldosData.fao_disponibles ?? 0}`);
      console.log("\nEl servicio FirmaWebService y el orquestador están listos para enviar liquidaciones reales.");
    } else {
      console.warn("⚠️ Advertencia al consultar saldos:", saldosData.Mensaje);
    }
  } catch (error) {
    console.error("\n💥 Error de conexión/red:", error.message);
  }
}

runTest();

