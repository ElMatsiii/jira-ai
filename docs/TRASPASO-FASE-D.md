# Traspaso: fase D de Jira AI

Documento para el equipo que continúa el proyecto. Resume lo hecho en las fases A, B y C, explica cómo levantar el sistema en local y detalla los pasos pendientes de la fase D, las reglas de trabajo y la deuda conocida.

Estado al 2026-11-15: rama `feat/mejoras-frontend-logica` en la raíz y en los 7 submódulos. `jira-contracts` ya está mergeado a `main` (PR #1 y #2); el resto de los repos espera su Pull Request (ver [Orden de los Pull Requests](#orden-de-los-pull-requests)).

---

## 1. Resumen de lo hecho

### Arquitectura actual

| Servicio | Repo | Rol |
| --- | --- | --- |
| Contratos | `jira-contracts` | `.proto` (gRPC) y JSON Schema (Kafka). Fuente única de los contratos. |
| MS1 | `jira-issues-go` | Incidencias, épicas, usuarios, espacios, proyectos, miembros por proyecto y horas. gRPC `:50051`, publica `issues.events`. |
| MS2 | `jira-sprints-nestjs` | Sprints. gRPC `:50052`. Lee y mueve incidencias en MS1 por gRPC. |
| MS3 | `jira-analytics-dotnet` | Burndown, velocidad, salud y riesgos. Consume `issues.events`, responde `analytics.query` → `analytics.reply`, lee sprints de MS2 por gRPC. |
| Agente IA | `jira-mcp-agent` | Gemini con motor offline de respaldo (REST `:3000`). |
| BFF | `jira-bff` | GraphQL `:4000`. Emite y valida el JWT. **No tiene base de datos**: todo pasa por gRPC (MS1, MS2), Kafka (MS3) o REST (MCP). |
| Web | `jira-web` | React + Apollo. |

### Fase A: errores del frontend (jira-web)
- Las historias sugeridas por la IA respetan su tipo y prioridad.
- Si el agente no responde, ya no se muestran subtareas inventadas.
- Se eliminaron operaciones GraphQL sin uso y se estabilizó el memo de incidencias.

### Fase B: errores de backend que rompían funciones (sin cambio de contrato)
- **MS1:** volvió a publicar eventos en Kafka (antes fallaban en silencio por el topic duplicado). `UpdateIssueStatus` usa control de versión. Se valida el proyecto, los enums y las transiciones al mismo estado.
- **BFF:** la consulta de analítica cumple el contrato de MS3; si MS3 no responde, devuelve `UNAVAILABLE` en vez de datos simulados. Se corrigió `aiPlanSprint` y se agregaron tests de guard y clientes gRPC.
- **MS3:**
  - Usa las fechas reales del sprint (gRPC a MS2) y modelos locales.
  - En el burndown, arrastra el último valor en los días sin registro.
  - La velocidad promedio solo cuenta sprints cerrados.
- **MCP:** responde en español y diagnostica el sprint solo hasta el día actual.
- **MS2:** las incidencias de MS1 se convierten a un modelo local.

### Fase C: el BFF deja la base de MS1 (cambios de contrato)
- **Contratos (dos rondas):**
  - **Primera ronda (PR #1):** `parent_id`; servicios `IdentityService`, `ProjectService` y `WorkLogService`; `capacity_story_points` en sprints; y en `analytics.reply`: `healthStatus`, `actualRemaining` nullable, `velocitySampleSize` y `PROJECT_TREND`.
  - **Segunda ronda (PR #2):** miembros por proyecto (`AddProjectMember`, `ListProjectMembers`, `RemoveProjectMember`), `Issue.reporter_name` y `ListWorkLogsRequest.issue_id`.
- **MS1:**
  - Migraciones 000002 a 000005: épica padre, identidad, horas y miembros por proyecto. Son compatibles con las tablas que antes creaba el BFF.
  - El hash `scrypt$<salt>$<hex>` es idéntico al del BFF, así que las cuentas existentes siguen funcionando.
  - Roles validados en MS1 con `requester_id`.
  - Acceso por proyecto: OWNER y ADMIN ven todo; un MEMBER solo los proyectos a los que fue invitado. Los miembros que existían conservaron el acceso a los proyectos que ya existían.
- **MS2 y MS3:** copias de los contratos sincronizadas.
- **MS3:**
  - Clasifica la salud (`HEALTHY`, `AT_RISK`, `CRITICAL`, `NOT_STARTED`, `NO_SCOPE`); ir adelantado ya no baja la salud.
  - El compromiso inicial (base del aumento de alcance) es el total que MS2 fija al iniciar el sprint.
- **BFF:** delega identidad, proyectos y horas a MS1; traduce los errores al español; expone `parentId`, `reporterName`, `velocitySampleSize`, `actualBurndown` nullable, miembros por proyecto y horas por incidencia.
- **Raíz:** el BFF ya no recibe `DATABASE_URL`.
- **Web:**
  - El desglose con IA crea la épica y vincula sus historias.
  - El backlog muestra las épicas con sus historias y el autor de cada incidencia.
  - Hay un panel de detalle de la incidencia y un panel de miembros del proyecto, con invitar y quitar.
  - Métricas: etiquetas "Sin iniciar" y "Sin alcance", "Sin sprints cerrados", y burndown con la línea ideal completa y la real hasta hoy.

---

## 2. Cómo levantar el proyecto en local

Requisitos: Docker Desktop (motor Linux) con Compose v2. Para correr tests fuera de contenedores: Go 1.22+, Node.js 20+ y .NET 8 SDK.

```bash
git clone --recurse-submodules https://github.com/ElMatsiii/jira-ai.git
cd jira-ai
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

- `GEMINI_API_KEY` en `.env` es opcional; sin ella, el agente usa su motor offline. No compartas `.env`.
- Web: http://localhost:5173 · GraphQL: http://localhost:4000/graphql · MCP: http://localhost:3000/healthz · MS3: http://localhost:8080/healthz.
- Bases: PostgreSQL de MS1 en `localhost:5434` (`issues_db`), de MS2 en `localhost:5433` (`sprints_db`), MongoDB de MS3 en `localhost:27017`.
- MS1 aplica sus migraciones en cada arranque. Son idempotentes, y el relleno de miembros (000005) se ejecuta una sola vez.
- Para reconstruir solo lo que cambió: `docker compose up -d --build <servicio>` (`issues-service`, `sprints-service`, `analytics-service`, `mcp-agent`, `bff-gateway`, `web-frontend`).

**Tests por repo (todos exigen ≥ 60 % de cobertura en el CI):**

| Repo | Comando |
| --- | --- |
| jira-contracts | `npm test -- --coverage` · regenerar: `npm run generate:all` |
| jira-issues-go | `go test -coverprofile=coverage.out ./... && bash scripts/check-coverage.sh coverage.out 60` |
| jira-sprints-nestjs | `npm run test:coverage` |
| jira-analytics-dotnet | `dotnet test tests/JiraAi.Analytics.UnitTests /p:CollectCoverage=true /p:Threshold=60` |
| jira-mcp-agent | `npm test -- --coverage` |
| jira-bff | `npm run test:coverage` |
| jira-web | `npm test` y `npm run build` |

**Notas de entorno:**
- Las pruebas de integración de MS1 se ejecutan solo con `JIRA_ISSUES_TEST_DATABASE_URL` apuntando a un Postgres desechable (por ejemplo `docker run --rm -p 55432:5432 -e POSTGRES_USER=it -e POSTGRES_PASSWORD=it -e POSTGRES_DB=issues_it postgres:16-alpine`). Sin esa variable se omiten, igual que en el CI.
- En Windows con `core.autocrlf=true`, `gofmt -l` marca todos los archivos por el CRLF. Para revisar un archivo: `tr -d '\r' < archivo.go | gofmt -l`.
- Windows reserva rangos de puertos (por ejemplo 50000–50159); si un servicio local no puede escuchar, usa otro puerto. Para ver los rangos: `netsh interface ipv4 show excludedportrange protocol=tcp`.
- Git Bash convierte los argumentos `/p:` de `dotnet test` como si fueran rutas; antepón `MSYS_NO_PATHCONV=1`.
- El CI de cada repo clona `jira-contracts` desde `main`. Para comparar contra los contratos publicados usa `origin/main` (haz `git fetch` antes).

---

## 3. Fase D: pasos pendientes

Todos los contratos que necesitan los pasos 19, 20, 21, 23, 24 y 25 **ya están en `jira-contracts/main`**. Ninguno de ellos requiere otra ronda de contratos.

### Paso 19: capacidad del sprint
- **Objetivo:** cada sprint guarda su capacidad en story points. Para sugerirla, MS2 pide a MS3 la velocidad histórica del proyecto (Kafka request-reply) y la valida al iniciar el sprint. El BFF y la web exponen el campo.
- **Contratos listos:**
  - `Sprint.capacity_story_points = 12` y `CreateSprintRequest.capacity_story_points = 6` (0 significa sin definir).
  - `analytics.query` con `queryType: PROJECT_TREND` y `analytics.reply` con `velocityHistory[]`, `velocity` y `velocitySampleSize`.
- **Repos y orden de commits (uno por repo):**
  1. `jira-analytics-dotnet`: responder `PROJECT_TREND`. Es el mismo commit de MS3 del paso 21; si el 21 se hace primero, aquí no hay nada que hacer.
  2. `jira-sprints-nestjs`:
     - Migración de la columna de capacidad.
     - Guardarla en la creación del sprint.
     - Usar `kafka-request-reply.service.ts`, que hoy existe pero nadie llama, para pedir `PROJECT_TREND`, **convirtiendo la respuesta a un modelo local**.
     - Sugerir la capacidad y validarla en `startSprint`.
  3. `jira-bff`:
     - `capacityStoryPoints` en `CreateSprintInput` y en `Sprint`; hoy envía 0 fijo en `sprints.resolver.ts`.
     - Query de capacidad sugerida.
  4. `jira-web`: campo de capacidad al crear el sprint, sugerencia y aviso si el alcance la supera.
- **Dependencias:** el MS3 del paso 21 (`PROJECT_TREND`).
- **Decisión pendiente:** si el alcance supera la capacidad al iniciar, ¿se bloquea el inicio o solo se advierte?

### Paso 20: sprints anteriores en Métricas
- **Objetivo:** un selector de sprint en Métricas (por defecto, el activo) que muestre el burndown de cualquier sprint, y que permita el diagnóstico con IA de un sprint cerrado.
- **Contratos:** no requiere cambios. `getBurndownAnalytics` y `aiDiagnoseMetrics` ya reciben cualquier `sprintId`, y MS3 conserva los snapshots cerrados.
- **Repos y orden:**
  1. `jira-bff`, solo si hace falta: para un sprint cerrado, enviar al MCP `asOfDate` = fecha de fin del sprint.
  2. `jira-web`: el selector, y tratar `COMPLETED` como "cerrado" en los textos.
- **Dependencias:** ninguna.

### Paso 21: análisis del proyecto
- **Objetivo:** una vista de proyecto con la tendencia de velocidad (comprometido frente a completado por sprint) y una retrospectiva general en español generada por la IA, con motor offline.
- **Contratos listos:**
  - `analytics.query`: `PROJECT_TREND` exige `projectId`, y `sprintId` deja de ser obligatorio (`if/then/else`).
  - `analytics.reply`: `projectId`, `queryType`, y `velocityHistory[]` con `sprintId`, `sprintName`, `committedStoryPoints`, `completedStoryPoints` y `completedDate`, del sprint más antiguo al más reciente.
  - Ningún `.proto` cambia.
- **Repos y orden:**
  1. `jira-analytics-dotnet`: responder `PROJECT_TREND` desde el historial de velocidad (modelo local → `velocityHistory`). Debe hacer eco de `queryType` y usar `projectId` como clave del mensaje cuando no hay `sprintId`.
  2. `jira-mcp-agent`: endpoint `POST /agent/project-retrospective`, con su motor offline y validación zod.
  3. `jira-bff`: query `getProjectVelocityTrend(projectId)` (Kafka `PROJECT_TREND`) y mutation `aiProjectRetrospective(projectId)` (REST al MCP), con verificación de acceso.
  4. `jira-web`: vista de proyecto en Métricas con el gráfico y la retrospectiva.
- **Dependencias:** ninguna. Conviene hacerlo antes del 19.

### Paso 23: permisos por rol en las operaciones de sprint
- **Objetivo:** definir qué roles pueden crear, iniciar, cerrar y asignar sprints. Hoy cualquiera con acceso al proyecto puede hacerlo.
- **Contratos:** no requiere cambios si la regla se aplica con el rol que ya devuelve `ProjectService.CheckProjectAccess` (`role`). Hacerlo dentro de MS2 requeriría `requester_id` en `sprints.proto`, es decir, otra ronda de contratos.
- **Repos y orden:**
  1. `jira-bff`: guard o verificación por operación con el rol de `CheckProjectAccess`, y mensajes en español.
  2. `jira-web`: ocultar o deshabilitar las acciones no permitidas.
- **Dependencias:** que el equipo decida la matriz de permisos. Ejemplo propuesto: OWNER y ADMIN crean, inician y cierran sprints; MEMBER solo asigna historias.

### Paso 24: traducir el motor offline del MCP
- **Objetivo:** traducir al español los textos que el motor offline todavía devuelve en inglés: desglose, estimación, Gherkin (salvo las palabras clave Given/When/Then) y planificación.
- **Repo:** solo `jira-mcp-agent`, un commit: `feat(mcp): traduce al español las respuestas del motor offline`.
- **Contratos y dependencias:** ninguno.

### Paso 25: mover libremente las incidencias en el Tablero
- **Objetivo:** mover una incidencia en cualquier dirección entre To Do, In Progress, In Review y Done. Hoy solo existe el botón "Avanzar →", y un clic por error no se puede deshacer desde el tablero.
  - **Con mouse:** arrastrar la tarjeta entre columnas (drag and drop).
  - **Sin mouse (accesible):** un selector de estado en la tarjeta, o botones "← Retroceder" y "Avanzar →".
- **Hallazgos al revisar el código:**
  - **MS1 bloquea parte de los movimientos.** `CanTransition` (`internal/domain/status.go`) permite avanzar de a un paso y solo algunos retrocesos: In Progress→To Do, In Review→In Progress y Done→To Do. Rechaza con `FAILED_PRECONDITION` los saltos (To Do→Done, In Progress→Done) y otros retrocesos (In Review→To Do, Done→In Progress, Done→In Review).
    - **Cambio:** permitir cualquier transición entre los 4 estados válidos.
    - Se mantienen: el control de versión (`ErrVersionConflict` → `ABORTED`) y que moverla al mismo estado no emita evento.
    - **Decisión pendiente:** ¿se permiten también los saltos hacia adelante (To Do→Done)? El pedido dice "en cualquier dirección".
  - **Contratos:** no requiere cambios. `UpdateIssueStatus(id, status)` ya existe, y `issues.events` ya incluye `previousStatus`.
  - **MS3 ya lo soporta.**
    - Con `ISSUE_STATUS_CHANGED`, `HandleIssueStatusChanged` resta de completados y suma a pendientes cuando la historia sale de DONE (`wasDone && !isDone`). Además actualiza el `actualRemaining` del día en el burndown.
    - Los cambios entre To Do, In Progress e In Review no mueven puntos; solo cuentan para la penalización por trabajo en curso.
    - Ya hay un test de reapertura en `IssuesEventProcessorTests`. No hace falta un commit en MS3, salvo agregar un test que recorra Done→In Review→Done.
  - **BFF:** `updateIssueStatus` no traduce los errores de MS1; hoy llega el texto crudo de gRPC. Hay que traducir al menos `ABORTED` ("La incidencia cambió mientras la movías, vuelve a intentarlo") y, si queda alguna regla, `FAILED_PRECONDITION`.
- **Repos y orden de commits:**
  1. `jira-issues-go`: `CanTransition` acepta cualquier transición entre estados válidos. → `feat(issues): permite mover incidencias entre cualquier estado`
  2. `jira-bff`: mensajes en español para los errores de `updateIssueStatus`. → `fix(bff): traduce los errores al cambiar el estado de una incidencia`
  3. `jira-web`: drag and drop entre columnas, más la alternativa accesible; actualización optimista con vuelta atrás si falla. → `feat(web): mueve incidencias entre columnas del tablero`
- **Tests sugeridos:**
  - **MS1:** reescribir la tabla de transiciones en `issue_test.go`, que hoy espera que varios movimientos fallen: ahora todos los pares válidos se aceptan y los estados inválidos se rechazan. En el servicio, verificar que retroceder publica `ISSUE_STATUS_CHANGED` con `previousStatus`.
  - **MS3 (opcional):** Done→In Review→Done deja completados y pendientes como estaban.
  - **BFF:** traducción de `ABORTED` y `FAILED_PRECONDITION`.
  - **Web:**
    - Soltar una tarjeta en otra columna llama a `updateIssueStatus` con el estado de esa columna.
    - Soltarla en su propia columna no llama.
    - Mover con teclado (selector o botones) hacia atrás y hacia adelante.
    - Si la mutación falla, la tarjeta vuelve a su columna y se muestra el error.
    - Cobertura ≥ 60 %.
- **Dependencias:** ninguna. Si se hace antes que el paso 23, más adelante habrá que decidir si mover tarjetas también depende del rol.
- **Nota técnica:** el drag and drop se puede hacer con la API nativa de HTML5 (`draggable`, `onDragStart`, `onDrop`), sin dependencias nuevas. Si se prefiere una librería (por ejemplo `@dnd-kit`), hay que acordarlo antes, porque agrega una dependencia.

### Paso 22: descartado
- El cierre de sprint con pendientes (`CompleteSprintRequest.move_to_sprint_id`) **queda descartado por ahora**.
- Requiere otra ronda de contratos (`sprints.proto`) que afecta a contracts, MS2, BFF, web y la copia de MS3.
- Mientras tanto, al cerrar un sprint las incidencias pendientes vuelven al backlog.

---

## 4. Reglas del proyecto

- **Commits:**
  - Pasos pequeños: un commit por repo y por paso, con mensaje Conventional Commits en español (`feat(issues): ...`, `fix(bff): ...`).
  - Nunca se hace commit directo en `main`: todo entra por Pull Request con merge commit, y la rama no se borra.
- **Contratos primero:**
  - Todo cambio de `.proto` o JSON Schema se hace en `jira-contracts` y se mergea a `main` antes que el resto, porque el CI de los demás repos clona `main`.
  - Hay que listar los repos afectados.
  - Las copias (`src/protos` en MS2 y `Contracts/Gen` en MS3) se sincronizan en su propio commit.
- **Interoperabilidad:**
  - Cada servicio convierte los datos que recibe por gRPC o Kafka a su modelo local; los tipos del proto no deben llegar al dominio.
  - Una base de datos por microservicio.
  - El BFF solo habla con los demás por gRPC, Kafka o REST (MCP).
- **Seguridad y datos:**
  - Los roles se validan en MS1 con `requester_id`; el BFF solo emite y verifica el JWT.
  - No se exponen ni se imprimen `GEMINI_API_KEY` ni el contenido de `.env`.
  - Los datos de los usuarios son privados.
- **Calidad:**
  - Cobertura ≥ 60 % en cada repo, con los tests del caso nuevo.
  - Los mensajes al usuario van en español; los errores internos de los servicios, en inglés (el BFF los traduce).
- **Alcance:** no se agregan funciones sin acordarlas antes.

---

## 5. Pendientes y deuda conocida

| # | Tema | Detalle |
| --- | --- | --- |
| 1 | **Secret de Gemini en k8s** | El Deployment `mcp-agent` (`k8s/apps/microservices-and-bff.yaml`) no recibe `GEMINI_API_KEY`. Hay que crear un `Secret` y referenciarlo con `secretKeyRef`; sin él, en k8s solo funciona el motor offline. |
| 2 | **`JWT_SECRET` en k8s** | El Deployment `bff-gateway` tampoco recibe `JWT_SECRET`, así que usa el valor de desarrollo que viene por defecto en el código. Debe venir de un `Secret` antes de cualquier despliegue. |
| 3 | **Suma de SP en las épicas** | La épica se crea con 0 SP y el backlog no suma los puntos de sus historias. Falta definir si la épica muestra la suma de sus hijas (solo cálculo en la web o el BFF) o si debe persistirse. |
| 4 | Seguridad del BFF | CORS abierto, playground de GraphQL activo y secreto JWT por defecto en el código. |
| 5 | Agente MCP | La salida de Gemini no se valida con zod (solo `JSON.parse`), el SSE admite una sola sesión y `OFFLINE_FALLBACK_ENABLED` no se usa. |
| 6 | CI | El CI clona `jira-contracts@main` sin fijar versión, y no hay un paso que verifique que `gen/` esté sincronizado con los `.proto`. |
| 7 | Cierre de sprint en MS2 | `completeSprint` mueve las incidencias en MS1 antes de guardar el sprint; si el guardado falla, los dos servicios quedan desincronizados. Iba junto al paso 22. |
| 8 | MS2 | `listSprints` todavía convierte el filtro numérico con el enum del proto en el servicio (se dejó así a propósito). |
| 9 | Identidad | `AddWorkspaceMember` (contrato y mutation del BFF) quedó sin uso desde que se invita por proyecto. No hay forma de ascender a ADMIN, de quitar a alguien de un espacio ni de que un MEMBER salga de un proyecto. |
| 10 | MS3 sin MS2 | Si MS2 no responde, MS3 no conoce el compromiso inicial y no detecta aumento de alcance (prefiere no avisar a avisar en falso). |
| 11 | README de la raíz | La sección "Probar el flujo de usuario" todavía describe la invitación al espacio; hoy se invita desde "Miembros del proyecto". |
| 12 | Autor de la incidencia | `reporter_name` se resuelve comparando `app_users.id::text` con `issues.reporter_id` (VARCHAR). Funciona, pero no usa índice; si crece mucho, conviene migrar `reporter_id` a UUID. |
| 13 | CI de jira-issues-go | El paso "Verify Module Dependencies" ya no usa `go mod verify`: falla siempre porque el módulo local `jira-contracts` (incluido con `replace`) no tiene un nombre válido para la caché de Go (no lleva punto en su ruta). Ahora usa `go mod download` más `go mod tidy` y `git diff --exit-code -- go.mod go.sum`. La solución de fondo sería renombrar el módulo (por ejemplo a `github.com/ElMatsiii/jira-contracts`). Eso exige cambiar el `go_package` de los `.proto`, regenerar `gen/go` y actualizar los imports de MS1: es otra ronda de contratos. |

---

## Orden de los Pull Requests

`jira-contracts` ya está en `main`. El resto se mergea en este orden, siempre con merge commit y sin borrar la rama, esperando el CI en verde de cada uno:

1. `jira-issues-go` (MS1)
2. `jira-sprints-nestjs` (MS2)
3. `jira-analytics-dotnet` (MS3)
4. `jira-mcp-agent`
5. `jira-bff`
6. `jira-web`
7. `jira-ai` (raíz, al final: actualiza los punteros de los submódulos y el `docker-compose.yml`)
