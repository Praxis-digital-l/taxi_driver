# Transportes El Montañez — Sistema de Control de Flota

Plataforma web integral para la gestión operativa, documental y financiera de flotas de transporte: administración de vehículos, seguros, conductores, nómina y liquidaciones con firma electrónica (**FirmaWeb**), control de ingresos y egresos, carga masiva por Excel/CSV, solicitudes, mensajería interna y registro de kilometraje.

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%7C_Postgres_%7C_Storage_%7C_Edge_Functions-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

> 📘 **¿Buscas la guía paso a paso para operar el sistema?**  
> Revisa el [**Manual de Usuario Completo (`MANUAL_DE_USUARIO.md`)**](./MANUAL_DE_USUARIO.md).

---

## Tabla de Contenidos

1. [Características Principales](#1-características-principales)
2. [Arquitectura y Stack Tecnológico](#2-arquitectura-y-stack-tecnológico)
3. [Rutas y Módulos del Sistema](#3-rutas-y-módulos-del-sistema)
4. [Requisitos Previos](#4-requisitos-previos)
5. [Instalación y Ejecución Local](#5-instalación-y-ejecución-local)
6. [Variables de Entorno (`.env`)](#6-variables-de-entorno-env)
7. [Infraestructura en Supabase](#7-infraestructura-en-supabase)
8. [Formato de Carga Masiva (Excel / CSV)](#8-formato-de-carga-masiva-excel--csv)
9. [Scripts Disponibles](#9-scripts-disponibles)
10. [Estructura del Proyecto](#10-estructura-del-proyecto)

---

## 1. Características Principales

### Panel de Administración (`admin`)
- **Dashboard Operativo en Tiempo Real**: Indicadores de flota activa, conductores registrados, solicitudes pendientes/en proceso, alertas de documentos y seguros próximos a vencer (30 días), mensajes no leídos y elección del **Conductor del Mes**.
- **Control Bancario (`/admin/banco`)**: Tablero de liquidez diaria con seguimiento de Línea de Crédito, Tarjeta de Crédito, Saldo Disponible y porcentaje de uso.
- **Gestión de Conductores (`/admin/conductores`)**:
  - Alta individual con creación automática de credenciales en Supabase Auth e ID correlativo (`TR-XXXXXX`).
  - Edición completa de perfil, estado operativo (`Nuevo`, `Antiguo`, `Desactivado`), fotografía de perfil, asignación de **Puntuación (`0` a `10`)** y gestión de **Vacaciones** (con cálculo de días, postergación de arriendo y porcentaje de recargo).
- **Cálculo de Nómina y Liquidaciones (`/admin/nomina`)**:
  - Cálculo automatizado de **Total Facturado**, **Descuentos Primarios** (Gasto operacional, Diesel, **TAG desglosado por autopistas**, Arriendo, Seguro), **Subtotal**, **Descuentos Secundarios** (Mantención, Anticipo, Préstamo, Otros descuentos personalizados, Efectivo) y **Total a Pagar**.
  - Generación de **PDF oficial de liquidación**.
  - Integración directa con **FirmaWeb** para firma electrónica del empleador o carga manual de PDF firmado.
- **Pendientes por Firmar (`/admin/pendientes`)**: Seguimiento del estado de firma en FirmaWeb, verificación en un clic, reenvío de documento y subida manual de PDF certificado para publicación inmediata en el perfil del conductor.
- **Detalle de Ingresos y Egresos (`/admin/finanzas`)**: Balance financiero consolidado mensual/anual con desglose de salidas de dinero (pagos líquidos, anticipos, préstamos), recuperaciones operacionales (combustible, TAG, seguros, mantenciones, efectivo) e ingreso neto interno (arriendos y gastos operacionales).
- **Gestión de Vehículos y Seguros (`/admin/vehicles`)**: Control de unidades por patente, estado (`activo`, `mantenimiento`, `inactivo`), asignación de conductores, pólizas de seguro con alertas de vencimiento y bitácora de notas administrativas.
- **Gestión Documental (`/admin/documents`)**: Repositorio centralizado de documentos legales de conductores y vehículos con semáforo de vigencia (`vigente`, `por_vencer`, `vencido`).
- **Carga Masiva (`/admin/bulk-upload`)**: Importación simultánea de usuarios (**conductores o administradores**) y vehículos vía archivos `.csv`, `.xlsx` o `.xls` con creación automática de cuentas con contraseña y asignación de vehículo.
- **Solicitudes y Mensajería (`/admin/requests`, `/admin/messages`)**: Gestión priorizada de requerimientos de conductores y canal de comunicación con confirmación de lectura.

### Panel del Conductor (`conductor`)
- **Dashboard Personal (`/conductor`)**: Resumen de estado, alertas de tareas o documentos por vencer, tarjeta de **Conductor del Mes**, visualización de su **Puntuación (`/10`)** y consulta de sus **Vacaciones**.
- **Mis Liquidaciones (`/conductor/liquidaciones`)**: Consulta del detalle de sus liquidaciones mensuales, estado de certificación del empleador, visualización en línea y descarga del PDF firmado.
- **Mis Vehículos (`/conductor/vehicles`)**: Ficha de los vehículos actualmente asignados.
- **Mis Documentos (`/conductor/documents`)**: Consulta y carga de documentos personales y del vehículo.
- **Mis Solicitudes (`/conductor/requests`)**: Envío de solicitudes a administración (mantenciones, anticipos, permisos, etc.) y seguimiento de estado.
- **Kilometraje (`/conductor/mileage`)**: Registro periódico de odómetro por vehículo asignado.
- **Mensajes (`/conductor/messages`)**: Recepción de comunicados de administración con acuse de lectura.

### Personalización de Perfil y Validaciones Chilenas
- Modal **"Mi Perfil"** accesible haciendo clic sobre el usuario en la barra lateral.
- Validación estricta de **RUT chileno** (algoritmo Módulo 11 con formateo automático `XX.XXX.XXX-X`) y **Teléfono móvil chileno** (`+569` + 8 dígitos obligatorios).
- Sincronización automática de cambio de correo electrónico entre `public.profiles` y `auth.users`, y cambio directo de contraseña.

---

## 2. Arquitectura y Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite 5
- **Estilos y Componentes UI**: Tailwind CSS + shadcn/ui (Radix UI) + Lucide Icons
- **Estado y Datos**: TanStack React Query v5 + Supabase JS Client v2
- **Generación de Documentos y Planillas**: `jspdf` (liquidaciones en PDF) + `xlsx` (lectura/escritura de Excel y CSV)
- **Backend Serverless (Supabase)**:
  - **PostgreSQL + RLS (Row Level Security)**: Políticas de seguridad por rol (`is_admin`, `can_access_profile`, `has_vehicle_access`) y triggers de integridad.
  - **Supabase Auth**: Autenticación por correo y contraseña.
  - **Supabase Storage**: Buckets `Avatares`, `documents` y `liquidaciones`.
  - **Supabase Edge Functions (Deno)**:
    - `create-conductor`: Creación y actualización de cuentas en Supabase Auth con asignación de rol (`admin` / `conductor`) e ID de trabajador.
    - `delete-conductor`: Eliminación segura de usuario en Auth y limpieza de registros.
    - `firmaweb`: Proxy seguro de integración con la API de firma digital **FirmaWeb**.
    - `send-push`: Envío de notificaciones Web Push (VAPID).

---

## 3. Rutas y Módulos del Sistema

| Ruta | Rol Requerido | Descripción |
| :--- | :--- | :--- |
| `/auth` | Público | Inicio de sesión en la plataforma |
| `/admin` | `admin` | Dashboard operativo de administración |
| `/admin/banco` | `admin` | Control diario de saldos y líneas bancarias |
| `/admin/documents` | `admin` | Gestión documental de flota y conductores |
| `/admin/conductores` | `admin` | Fichas de conductores, puntuación, estado y vacaciones |
| `/admin/nomina` | `admin` | Cálculo de nómina, generación de PDF y envío a FirmaWeb |
| `/admin/pendientes` | `admin` | Control de liquidaciones pendientes de firma y carga manual de PDF |
| `/admin/finanzas` | `admin` | Balance consolidado de ingresos, egresos y recuperaciones |
| `/admin/vehicles` | `admin` | Gestión de vehículos, asignaciones, seguros y notas |
| `/admin/requests` | `admin` | Bandeja priorizada de solicitudes de conductores |
| `/admin/messages` | `admin` | Envío y seguimiento de mensajes a conductores |
| `/admin/bulk-upload` | `admin` | Carga masiva de usuarios (`admin`/`conductor`) y vehículos vía CSV/Excel |
| `/conductor` | `conductor` | Dashboard personal del conductor |
| `/conductor/vehicles` | `conductor` | Vehículos asignados al conductor |
| `/conductor/documents` | `conductor` | Documentos del conductor y alertas de vencimiento |
| `/conductor/requests` | `conductor` | Creación y seguimiento de solicitudes |
| `/conductor/mileage` | `conductor` | Registro e historial de kilometraje |
| `/conductor/liquidaciones` | `conductor` | Historial y descarga de liquidaciones en PDF |
| `/conductor/messages` | `conductor` | Bandeja de mensajes recibidos |

---

## 4. Requisitos Previos

- **Node.js** `>= 18.x` (recomendado `20 LTS`)
- **npm** `>= 9.x`
- Proyecto activo en **Supabase** (para conexión a base de datos, Auth, Storage y Edge Functions)

---

## 5. Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/4lejandroo/taxi_driver.git
   cd taxi_driver
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto siguiendo la sección [Variables de Entorno](#6-variables-de-entorno-env).

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000` (o el puerto indicado en consola).

---

## 6. Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto con las siguientes claves:

```env
# Configuración de Supabase
VITE_SUPABASE_PROJECT_ID=tu_project_id
VITE_SUPABASE_URL=https://tu_project_id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_public_key

# Clave pública VAPID para notificaciones Web Push (opcional)
VITE_VAPID_PUBLIC_KEY="tu_vapid_public_key"

# Configuración de FirmaWeb (utilizada en Edge Function / integración de firma)
FIRMAWEB_ENV=dev
FIRMAWEB_USER=tu_usuario_firmaweb
FIRMAWEB_PASS=tu_password_firmaweb
FIRMAWEB_EMPLEADOR_EMAIL=correo_empleador@empresa.cl
```

---

## 7. Infraestructura en Supabase

### 7.1 Migraciones de Base de Datos
Todas las migraciones SQL se encuentran en `supabase/migrations/`. Para aplicarlas sobre tu proyecto de Supabase vinculado:

```bash
npx supabase link --project-ref <TU_PROJECT_ID>
npx supabase db push
```

### 7.2 Buckets de Storage Requeridos
El proyecto utiliza tres buckets en **Supabase Storage**:
- `Avatares` (público): Fotografías de perfil de conductores y administradores.
- `documents` (privado/autenticado): Documentación legal de vehículos y conductores.
- `liquidaciones` (público/autenticado): Archivos PDF de liquidaciones generadas y firmadas.

### 7.3 Despliegue de Edge Functions
Para desplegar las funciones serverless ubicadas en `supabase/functions/`:

```bash
npx supabase functions deploy create-conductor --no-verify-jwt
npx supabase functions deploy delete-conductor --no-verify-jwt
npx supabase functions deploy firmaweb --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt
```

---

## 8. Formato de Carga Masiva (Excel / CSV).

Desde `/admin/bulk-upload` puedes descargar la plantilla oficial `plantilla_carga_datos.csv`, la cual soporta las siguientes **13 columnas**:

```csv
Nombres,Apellido Paterno,Apellido Materno,Email,Teléfono,RUT,Contraseña,Rol,Patente,Marca,Modelo,Año,Color
Carlos,Muñoz,Rojas,carlos@ejemplo.cl,+56912345678,12.345.678-5,Clave1234,conductor,ABCD-12,Toyota,Hiace,2023,Blanco
Ana,Pérez,Soto,ana@ejemplo.cl,+56987654321,11.111.111-1,Admin1234,admin,,,,,
```

- **`Rol`**: Permite especificar `conductor` o `admin` (si se omite, asigna `conductor` por defecto).
- **`Contraseña`**: Si se indica (mínimo 6 caracteres) junto con el `Email`, crea automáticamente el usuario en Supabase Auth listo para iniciar sesión.
- **`Patente`**: Si se incluye en la misma fila que un conductor, crea/actualiza el vehículo y lo vincula automáticamente a dicho conductor.

---

## 9. Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente (HMR) |
| `npm run build` | Compila la aplicación optimizada para producción en la carpeta `dist/` |
| `npm run preview` | Levanta un servidor local para probar el build de producción |
| `npm run lint` | Ejecuta ESLint sobre el código fuente |
| `npm run test` | Ejecuta la suite de pruebas unitarias con Vitest |
| `npx tsc --noEmit` | Verifica el tipado estático de TypeScript en todo el proyecto |

---

## 10. Estructura del Proyecto

```text
taxi_driver/
├── public/                        # Recursos estáticos e íconos PWA
├── src/
│   ├── components/                # Componentes transversales (UserProfileDialog, ConductorAvatar, UI shadcn)
│   ├── features/
│   │   ├── admin/                 # Páginas y servicios del panel de Administración
│   │   ├── auth/                  # Contexto de autenticación, rutas protegidas y login
│   │   ├── conductor/             # Páginas, componentes y servicios del panel de Conductor
│   │   ├── nomina/                # Cálculo de nómina, PDF, pendientes de firma y finanzas
│   │   └── notifications/         # Proveedor de notificaciones Web Push
│   ├── hooks/                     # Custom hooks de React
│   ├── integrations/supabase/     # Cliente Supabase y definición de tipos de base de datos
│   ├── lib/                       # Utilidades de negocio (validaciones de RUT/teléfono, cálculo de nómina)
│   ├── services/firmaweb/         # Cliente de integración con FirmaWeb
│   ├── shared/layouts/            # Layout principal (AppLayout, barra lateral y navegación)
│   ├── App.tsx                    # Definición de rutas principales
│   └── main.tsx                   # Punto de entrada de la aplicación
├── supabase/
│   ├── functions/                 # Edge Functions (create-conductor, delete-conductor, firmaweb, send-push)
│   └── migrations/                # Migraciones SQL (esquema, RLS, funciones y triggers)
├── MANUAL_DE_USUARIO.md           # Manual de uso detallado para el cliente final
├── README.md                      # Documentación técnica del repositorio
└── package.json
```

---

## 👨‍💻 Desarrollado por

**PraxisDigital** — Equipo de desarrollo de software para **Transportes El Montañez**.
