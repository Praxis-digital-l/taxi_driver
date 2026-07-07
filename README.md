# FlotaControl

Frontend web para la operacion diaria de flota: administracion de vehiculos, conductores, documentos, solicitudes, mensajes y kilometraje.

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.x-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

## Contenido

1. [Que resuelve esta plataforma](#que-resuelve-esta-plataforma)
2. [Inicio rapido (recomendado)](#inicio-rapido-recomendado)
3. [Credenciales locales de prueba](#credenciales-locales-de-prueba)
4. [Modo Supabase real](#modo-supabase-real)
5. [Reset de contrasenas de conductores](#reset-de-contrasenas-de-conductores)
6. [Scripts disponibles](#scripts-disponibles)
7. [Rutas principales](#rutas-principales)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Bitacora development.log](#bitacora-developmentlog)
10. [Troubleshooting rapido](#troubleshooting-rapido)
11. [Guia para contribuir](#guia-para-contribuir)

## Que resuelve esta plataforma

### Para conductores

- Subida de documentos por tipo (liquidacion, combustible, taller, seguros, TAG, repuestos, etc).
- Registro manual de kilometraje.
- Solicitudes (anticipos, prestamos, combustible, mantencion, permisos).
- Mensajes con estado (`pendiente`, `en_proceso`, `completado`).

### Para administracion

- Dashboard con indicadores y tareas pendientes.
- Busqueda por patente con ficha consolidada de vehiculo.
- Gestion de vehiculos y asignacion de conductores.
- Gestion de solicitudes con prioridad de negocio.
- Mensajeria a conductores y notas internas por patente.
- Gestion de roles (`admin`, `super_admin`, `conductor`).

## Inicio rapido (recomendado)

Este repositorio ya viene preparado para trabajar **100% local** usando mock (sin depender de Supabase remoto).

### 1) Clonar e instalar

```bash
git clone https://github.com/CQuirozVidal/sistema-control-flota.git
cd sistema-control-flota
npm install
```

### 2) Ejecutar

```bash
npm run dev
```

Abrir en:

```text
http://localhost:8080/auth
```

### 3) Probar login

Usa cualquiera de las credenciales locales de la seccion siguiente. La app ya muestra en pantalla que esta en modo local.

## Credenciales locales de prueba

Con `VITE_USE_MOCK_SUPABASE=true`, todos estos usuarios entran con la misma clave:

```text
Contrasena: 123456
```

### Admin

- `admincorto@santaaurora.cl`
- `admin.flota@santaaurora.cl`

### Conductores

- `antonia.gajardo@demo-flota.cl`
- `camila.soto@demo-flota.cl`
- `francisca.henriquez@demo-flota.cl`
- `diego.vargas@demo-flota.cl`
- `bruno.sanmartin@demo-flota.cl`
- `matias.rojas@demo-flota.cl`

## Modo Supabase real

Si quieres dejar de usar mock y conectar contra Supabase:

1. En `.env.local`, desactiva mock:

```env
VITE_USE_MOCK_SUPABASE=false
```

2. Define variables reales del proyecto:

```env
VITE_SUPABASE_PROJECT_ID=tu_project_id
VITE_SUPABASE_URL=https://tu_project_id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

3. Reinicia el servidor:

```bash
npm run dev
```

Nota: la `publishable key` sirve para frontend. Operaciones admin (como reset de contrasenas) requieren `service_role` o `sb_secret`.

## Reset de contrasenas de conductores

Script disponible:

```bash
npm run reset:conductors:password
```

Requisitos:

- `VITE_SUPABASE_URL` valido.
- `SUPABASE_SERVICE_ROLE_KEY` real (no `publishable`, no placeholder).

Ejemplo correcto:

```bash
export SUPABASE_SERVICE_ROLE_KEY='TU_SERVICE_ROLE_REAL_COMPLETA'
npm run reset:conductors:password
```

Contrasena por defecto aplicada por el script:

```text
123456
```

Si quieres otra:

```bash
DEFAULT_TEST_PASSWORD='ClaveNueva123' npm run reset:conductors:password
```

## Scripts disponibles

| Script | Comando | Uso |
|---|---|---|
| Desarrollo | `npm run dev` | Levanta Vite en `localhost:8080` |
| Build | `npm run build` | Compila para produccion |
| Build dev | `npm run build:dev` | Build en modo desarrollo |
| Preview | `npm run preview` | Sirve build local |
| Lint | `npm run lint` | Revision estatica |
| Test | `npm run test` | Tests unitarios |
| Test watch | `npm run test:watch` | Tests en observacion |
| Reset claves conductores | `npm run reset:conductors:password` | Cambia contrasenas en Supabase real |
| Deploy GH Pages | `npm run deploy` | Publica carpeta `dist` |

## Rutas principales

| Ruta | Acceso | Descripcion |
|---|---|---|
| `/auth` | Publico | Login y registro |
| `/admin` | `admin` / `super_admin` | Dashboard administrador |
| `/admin/search` | `admin` / `super_admin` | Busqueda por patente |
| `/admin/vehicles` | `admin` / `super_admin` | Gestion de vehiculos |
| `/admin/requests` | `admin` / `super_admin` | Gestion de solicitudes |
| `/admin/messages` | `admin` / `super_admin` | Mensajes a conductores |
| `/admin/users` | `super_admin` | Gestion de roles |
| `/conductor` | `conductor` | Dashboard conductor |
| `/conductor/vehicles` | `conductor` | Vehiculos asignados |
| `/conductor/documents` | `conductor` | Documentos |
| `/conductor/requests` | `conductor` | Solicitudes |
| `/conductor/mileage` | `conductor` | Kilometraje |
| `/conductor/messages` | `conductor` | Mensajes recibidos |

## Estructura del proyecto

```text
sistema-control-flota/
|-- public/
|-- scripts/
|   |-- reset-conductors-password.mjs
|-- src/
|   |-- components/
|   |-- features/
|   |   |-- auth/
|   |   |-- admin/
|   |   |-- conductor/
|   |-- integrations/
|   |   |-- supabase/
|   |       |-- client.ts
|   |       |-- mock.ts
|   |       |-- types.ts
|   |-- shared/
|   |-- lib/
|   |-- test/
|-- supabase/
|   |-- config.toml
|   |-- migrations/
|-- development.log
|-- vite.config.ts
|-- package.json
```

## Bitacora development.log

`development.log` se actualiza automaticamente en desarrollo e incluye:

- eventos de UI (login, registro, acciones clave),
- llamadas a `/supabase/*` (metodo, endpoint, estado, duracion).

Sirve para depurar errores funcionales y revisar flujo real de uso.

## Troubleshooting rapido

### 1) "Failed to fetch" al iniciar sesion

- Verifica que `npm run dev` siga levantado.
- Revisa que estes abriendo `http://localhost:8080`.
- Para trabajo local, confirma `VITE_USE_MOCK_SUPABASE=true` en `.env.local`.

### 2) "Invalid API key" al correr reset de contrasenas

- Estas usando una key incorrecta (`publishable` o placeholder).
- Usa la `service_role` real del mismo proyecto de `VITE_SUPABASE_URL`.

### 3) Cambie `.env.local` y no aplica

Reinicia Vite:

```bash
# detener servidor
npm run dev
```

### 4) Login queda en estado raro entre pruebas

Limpia sesion local (mock):

- Cerrar sesion desde UI, o
- limpiar `localStorage` del navegador para el dominio local.

## Guia para contribuir

1. Crear rama:

```bash
git checkout -b feature/tu-cambio
```

2. Validar antes de commit:

```bash
npm run lint
npm run test
npm run build
```

3. Commit y push:

```bash
git add .
git commit -m "docs: improve README"
git push origin feature/tu-cambio
```

4. Abrir PR y adjuntar:

- alcance funcional,
- capturas de pantallas relevantes,
- pasos de prueba reproducibles.
