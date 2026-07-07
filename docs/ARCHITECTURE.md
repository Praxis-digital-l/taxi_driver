# Arquitectura del proyecto (SOLID + Clean Code)

## Objetivo
Separar responsabilidades por dominio para facilitar mantenimiento, pruebas y escalabilidad.

## Estructura base
- `src/features/auth`: autenticación, contexto de sesión y control de acceso.
- `src/features/admin`: UI y casos de uso del panel administrador.
- `src/features/conductor`: UI y casos de uso del panel conductor.
- `src/shared`: layout y piezas reutilizables entre dominios.
- `src/components/ui`: design system (presentacional puro).
- `src/integrations/supabase`: adaptador de infraestructura (SDK + tipos).

## Criterios de diseño
- **S (Single Responsibility)**: cada módulo `feature` encapsula su responsabilidad.
- **O (Open/Closed)**: se extiende por nuevos módulos sin modificar los existentes.
- **L (Liskov Substitution)**: componentes comparten contratos consistentes.
- **I (Interface Segregation)**: cada feature usa solo dependencias mínimas necesarias.
- **D (Dependency Inversion)**: lógica de negocio depende de abstracciones y servicios, no de UI.

## Convenciones
- No mezclar lógica de dominio en `components/ui`.
- Mantener rutas de cada feature en `src/features/<feature>/pages`.
- Mantener utilidades cross-feature en `src/shared`.
- Registrar eventos de depuración en `development.log` durante desarrollo.
