# JIRAN'T — Plataforma Políglota de Gestión Ágil con IA (Orquestador)

[![GitHub Organization](https://img.shields.io/badge/GitHub-ElMatsiii-181717.svg?logo=github)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-11_Services_%2B_Init-2496ED?logo=docker)]()
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Manifests_Ready-326CE5?logo=kubernetes)]()

Repositorio orquestador (`jira-ai`) del ecosistema distribuido **JIRAN'T**: una plataforma de gestión ágil de proyectos construida sobre microservicios políglotas en **Go, TypeScript y C# (.NET 8)** (sin Python), bases de datos dedicadas por servicio (*Database-per-Service*), comunicación híbrida con **gRPC** y **Apache Kafka**, API Gateway **GraphQL** stateless en NestJS, **Frontend Web SPA** en React 18 y un **Agente IA Scrum Master** basado en el protocolo **MCP (Model Context Protocol)** con **Google Gemini** y motor heurístico offline en español.

---

## 1. Repositorios y Arquitectura de Microservicios

El proyecto está organizado en una arquitectura **multi-repositorio** vinculada mediante submódulos Git:

| # | Repositorio | Stack Tecnológico | Rol y Protocolos | Cobertura |
| :-: | :--- | :--- | :--- | :---: |
| **1** | [**`ElMatsiii/jira-contracts`**](https://github.com/ElMatsiii/jira-contracts) | Protobuf v3 + JSON Schema | Contratos canónicos gRPC y esquemas de eventos Kafka | **100.00%** |
| **2** | [**`ElMatsiii/jira-issues-go`**](https://github.com/ElMatsiii/jira-issues-go) | Go 1.22+ (Zero-CGO) + `database/sql` + PostgreSQL | MS1: Incidencias, épicas, identidad (usuarios/espacios/roles), proyectos, miembros y registro de horas. gRPC Server (`:50051`), Kafka Producer (`issues.events`) | **64.80%** |
| **3** | [**`ElMatsiii/jira-sprints-nestjs`**](https://github.com/ElMatsiii/jira-sprints-nestjs) | TypeScript + NestJS + TypeORM + PostgreSQL | MS2: Sprints, ciclo de vida y capacidad en Story Points. gRPC Server (`:50052`), cliente gRPC a MS1 y Kafka Request-Reply (`PROJECT_TREND`) a MS3 | **85.99%** |
| **4** | [**`ElMatsiii/jira-analytics-dotnet`**](https://github.com/ElMatsiii/jira-analytics-dotnet) | .NET 8 (C#) Clean Architecture + MongoDB | MS3: Curva Burndown ideal vs. real, velocidad de sprints cerrados, tendencia del proyecto, salud del sprint y detección de aumento de alcance. Kafka Worker y cliente gRPC a MS2 | **76.80%** |
| **5** | [**`ElMatsiii/jira-mcp-agent`**](https://github.com/ElMatsiii/jira-mcp-agent) | TypeScript + MCP SDK + Google Gemini | Agente IA Scrum Master (`:3000`): desglose de épicas, segmentación de tareas, mejora Gherkin, diagnóstico de sprint y retrospectiva, con respaldo heurístico offline en español | **83.50%** |
| **6** | [**`ElMatsiii/jira-bff`**](https://github.com/ElMatsiii/jira-bff) | TypeScript + NestJS + GraphQL (Stateless) | API Gateway (`:4000/graphql`): autenticación JWT, control de permisos por rol, traducción de errores al español y orquestación hacia MS1 (gRPC), MS2 (gRPC), MS3 (Kafka) y MCP (REST) | **74.23%** |
| **7** | [**`ElMatsiii/jira-web`**](https://github.com/ElMatsiii/jira-web) | React 18 + Vite + TypeScript + Apollo Client | Frontend Web SPA de **JIRAN'T**: Backlog, Tablero Kanban libre, Cronograma, Rendimiento/Métricas, Miembros por proyecto y panel IA | **94.70%** |

> Todos los repositorios cuentan con integración continua (GitHub Actions) y superan el umbral obligatorio de **>= 60% de cobertura de pruebas**.

### Reglas arquitectónicas clave

- **Base de datos por microservicio**: `issues_db` (PostgreSQL en MS1), `sprints_db` (PostgreSQL en MS2) y `analytics_db` (MongoDB en MS3). El BFF es completamente *stateless* y nunca accede directamente a ninguna base de datos.
- **Regla de interoperabilidad**: Toda llamada hacia otro microservicio se realiza en el protocolo nativo del servicio destino (gRPC o Kafka) usando los contratos de `jira-contracts`, y cada servicio traduce la respuesta a su modelo de dominio local.
- **Sin Python**: Todo el ecosistema (incluyendo el servidor MCP de IA) está implementado en Go, TypeScript y C#.

---

## 2. Requisitos y Clonación

Para ejecutar el stack completo en contenedores se requiere **Docker Desktop** (motor Linux con Docker Compose v2; opcionalmente con Kubernetes habilitado para despliegue en clúster local). Para ejecutar pruebas o servicios fuera de contenedores se requiere **Node.js 20+** (22.6+ recomendado para la suite E2E mock), **Go 1.22+** y **.NET 8 SDK**.

### Opción A: Clonado con Git Submodules (Recomendada)
```bash
git clone --recurse-submodules https://github.com/ElMatsiii/jira-ai.git
cd jira-ai
```

Si ya clonaste el repositorio sin `--recurse-submodules`, inicializa los submódulos con:
```bash
git submodule update --init --recursive
```

### Opción B: Script de Inicialización Automatizada
- **Windows (PowerShell):**
  ```powershell
  .\clone-all.ps1
  ```
- **Linux / macOS (Bash):**
  ```bash
  chmod +x ./clone-all.sh
  ./clone-all.sh
  ```

---

## 3. Puesta en Marcha con Docker Compose

### Configuración de variables de entorno
En PowerShell:
```powershell
Copy-Item .env.example .env
```
En Linux / macOS:
```bash
cp .env.example .env
```

- `GEMINI_API_KEY` es opcional: si se omite o si la API externa no está disponible, el agente MCP utiliza automáticamente su motor heurístico offline en español. El modelo configurado por defecto en los contenedores es `gemini-3.5-flash-lite` (con timeout de 13 segundos para evitar esperas prolongadas en el BFF).
- `JWT_SECRET` firma los tokens de sesión (12 horas de vigencia). Reemplaza el valor de ejemplo antes de cualquier despliegue fuera de entorno local y no compartas el archivo `.env`.

### Levantar el ecosistema completo
Desde la raíz del repositorio:
```bash
docker compose up --build -d
docker compose ps
```

La primera compilación puede tardar varios minutos. Docker Compose espera los healthchecks de PostgreSQL, MongoDB, Zookeeper y Kafka, ejecuta el contenedor de inicialización de tópicos (`jira-kafka-init`) y luego arranca los microservicios, el BFF y el frontend.

> **Nota sobre `jira-kafka-init`:** Es normal que este contenedor aparezca detenido (`Exited (0)`) tras el arranque. Su única responsabilidad es crear de forma idempotente los tópicos `issues.events`, `analytics.query` y `analytics.reply` en Kafka y finalizar correctamente antes de iniciar los consumidores.

Para ver logs o detener el stack sin perder datos persistidos en volúmenes:
```bash
docker compose logs -f
docker compose down
```

### Endpoints y Puertos Principales
- **Frontend Web (JIRAN'T):** [http://localhost:5173](http://localhost:5173) y [http://localhost](http://localhost) (puerto `:80`)
- **BFF GraphQL Playground:** [http://localhost:4000/graphql](http://localhost:4000/graphql)
- **MCP Agent Health:** [http://localhost:3000/healthz](http://localhost:3000/healthz)
- **MS1 Issues & Identity (gRPC):** `localhost:50051`
- **MS2 Sprints (gRPC):** `localhost:50052`
- **MS3 Analytics Worker (HTTP Health):** [http://localhost:8080/healthz](http://localhost:8080/healthz)
- **Apache Kafka Broker:** `kafka:9092` (interno) / `localhost:29092` (host)
- **PostgreSQL Incidencias (MS1):** `localhost:5434` (`issues_db`)
- **PostgreSQL Sprints (MS2):** `localhost:5433` (`sprints_db`)
- **MongoDB Analítica (MS3):** `localhost:27017` (`analytics_db`)

### Flujo de uso en JIRAN'T
1. **Registro y acceso:** Abre `http://localhost:5173` (o `http://localhost`) y crea una cuenta con nombre, correo electrónico y contraseña de al menos 10 caracteres. El registro crea automáticamente un espacio de trabajo personal con rol `OWNER`.
2. **Proyectos y miembros:** Crea un proyecto indicando nombre y clave de 2 a 10 caracteres (por ejemplo, `JIRANT`). Para colaborar, la otra persona debe estar registrada; luego un `OWNER` o `ADMIN` puede agregarla o quitarla desde el panel **Miembros del proyecto**. Los roles `OWNER` y `ADMIN` ven todos los proyectos y gestionan sprints; un `MEMBER` accede únicamente a los proyectos a los que fue invitado.
3. **Backlog y desglose con IA:** Crea épicas, historias, tareas o bugs con estimación en escala Fibonacci, prioridad y criterios de aceptación. El modal permite creación múltiple en rejilla (hasta 6 incidencias en formato 3x2) con segmentación de subtareas asistida por IA, mejora de historias en formato Gherkin y desglose completo de épicas vinculando sus historias hijas. Cada incidencia muestra su autor y abre un panel de detalle al seleccionarla.
4. **Asignación y retorno al Backlog:** Desde el selector de sprint de cada incidencia en **Backlog** puedes asignarla a un sprint planificado/activo o seleccionar nuevamente **Backlog** para retirarla del sprint en cualquier momento.
5. **Cronograma de Sprints:** En **Cronograma**, los roles con permiso crean sprints definiendo fechas, objetivo y capacidad en Story Points (con sugerencia basada en la velocidad histórica del proyecto), los inician y los completan.
6. **Tablero Scrum Kanban:** En **Tablero**, las incidencias del sprint activo se organizan en 4 columnas (`To Do`, `In Progress`, `In Review`, `Done`) con movimiento libre en cualquier dirección mediante arrastrar y soltar (drag & drop) o controles accesibles, protegido con control de concurrencia optimista.
7. **Rendimiento y Analítica:** En **Rendimiento**, puedes registrar horas trabajadas por incidencia, consultar la curva Burndown (ideal vs. real hasta la fecha) tanto del sprint activo como de sprints anteriores cerrados, revisar la salud del sprint y la tendencia de velocidad del proyecto, y solicitar diagnósticos de sprint o una retrospectiva general con IA.

---

## 4. Guía de Desarrollo por Microservicio (Flujo Aislado)

Un desarrollador no necesita compilar todos los contenedores para trabajar en un microservicio puntual.

### Paso 1: Levantar solo la infraestructura
```bash
docker compose up -d postgres-issues postgres-sprints mongo-analytics zookeeper kafka kafka-init
```

### Paso 2: Ejecutar cada servicio localmente
Para `jira-bff` y `jira-sprints-nestjs`, compila primero `jira-contracts` (`npm ci && npm run build`) e instala dependencias con `npm ci` antes de iniciar. En modo local, Kafka se conecta por `localhost:29092`.

- **MS1 (Go):**
  ```powershell
  Push-Location jira-issues-go
  $env:DATABASE_URL = "postgres://jira_user:jira_password@localhost:5434/issues_db?sslmode=disable"
  $env:KAFKA_BROKERS = "localhost:29092"
  go run cmd/server/main.go
  Pop-Location
  ```
- **MS2 (NestJS):**
  ```powershell
  Push-Location jira-sprints-nestjs
  $env:DB_HOST = "localhost"; $env:DB_PORT = "5433"
  $env:DB_USER = "jira_user"; $env:DB_PASSWORD = "jira_password"; $env:DB_NAME = "sprints_db"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MS1_GRPC_URL = "localhost:50051"
  npm run start:dev
  Pop-Location
  ```
- **MS3 (.NET 8):**
  ```powershell
  Push-Location jira-analytics-dotnet
  $env:MONGODB_URI = "mongodb://localhost:27017"; $env:MONGODB_DATABASE = "analytics_db"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MS2_GRPC_URL = "http://localhost:50052"
  dotnet run --project src/JiraAi.Analytics.Worker
  Pop-Location
  ```
- **Agente MCP:**
  ```powershell
  Push-Location jira-mcp-agent
  npm run dev
  Pop-Location
  ```
- **BFF Gateway (NestJS GraphQL):**
  ```powershell
  Push-Location jira-bff
  $env:ISSUES_GRPC_URL = "localhost:50051"; $env:SPRINTS_GRPC_URL = "localhost:50052"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MCP_AGENT_URL = "http://localhost:3000"
  npm run start:dev
  Pop-Location
  ```
- **Frontend Web (React 18):**
  ```powershell
  Push-Location jira-web
  npm run dev
  Pop-Location
  ```

---

## 5. Pruebas y Validación Técnica

### Pruebas Unitarias y Cobertura por Repositorio
Todos los repositorios validan un mínimo de **60% de cobertura** en su pipeline CI:

- **Contratos compartidos (`jira-contracts`):** `npm ci && npm run build && npm test -- --coverage`
- **MS1 Issues (`jira-issues-go`):** `go test -v -coverprofile=coverage.out ./...`
- **MS2 Sprints (`jira-sprints-nestjs`):** `npm ci && npm run test:coverage && npm run build`
- **MS3 Analytics (`jira-analytics-dotnet`):** `dotnet test tests/JiraAi.Analytics.UnitTests/JiraAi.Analytics.UnitTests.csproj`
- **Agente MCP (`jira-mcp-agent`):** `npm ci && npm run test:coverage && npm run build`
- **BFF Gateway (`jira-bff`):** `npm ci && npm run test:coverage && npm run build`
- **Frontend Web (`jira-web`):** `npm ci && npm test && npm run build`

### Suite E2E y Comprobación Smoke en Vivo
- **Suite E2E (simulada sin contenedores):**
  ```bash
  cd tests/e2e
  npm test
  ```
- **Smoke test contra el stack levantado (Docker o Kubernetes):**
  ```bash
  cd tests/e2e
  npm run smoke:live
  ```
- **Comprobación manual rápida (PowerShell):**
  ```powershell
  Invoke-RestMethod http://localhost:3000/healthz
  Invoke-RestMethod -Uri http://localhost:4000/graphql -Method Post -ContentType 'application/json' -Body '{"query":"{ __typename }"}'
  ```

### Inspección de gRPC y Eventos Kafka
- **gRPC directo (grpcurl):**
  ```bash
  grpcurl -plaintext -proto ./jira-contracts/protos/issues.proto \
    -d '{"title": "Nueva Incidencia", "project_id": "PROJ-1"}' \
    localhost:50051 jira.issues.v1.IssueService/CreateIssue
  ```
- **Consumo de eventos en Kafka (Docker):**
  ```bash
  docker exec -it jira-kafka kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic issues.events \
    --from-beginning
  ```

---

## 6. Despliegue en Kubernetes (K8s)

El repositorio incluye manifiestos completos y probados para desplegar todo el ecosistema en un clúster local (como **Docker Desktop Kubernetes**, Minikube o Kind) bajo el namespace `jira-ai`.

### Paso 1: Construir las imágenes locales
Desde la raíz `jira-ai`, construye las imágenes que referencian los manifiestos de `k8s/apps/microservices-and-bff.yaml`:
```powershell
docker build -f jira-issues-go/Dockerfile -t jira-issues-service:latest .
docker build -f jira-sprints-nestjs/Dockerfile -t jira-sprints-service:latest .
docker build -f jira-analytics-dotnet/Dockerfile -t jira-analytics-service:latest ./jira-analytics-dotnet
docker build -f jira-mcp-agent/Dockerfile -t jira-mcp-agent:latest ./jira-mcp-agent
docker build -f jira-bff/Dockerfile -t jira-bff-gateway:v2 .
docker build -f jira-web/Dockerfile -t jira-web-frontend:v2 ./jira-web
```

### Paso 2: Crear el namespace y los secretos
Crea el namespace y configura el `Secret` (`jira-ai-secrets`) tomando como plantilla `k8s/apps/secrets.example.yaml`:
```powershell
kubectl apply -f k8s/namespace.yaml

# Opcional: copia k8s/apps/secrets.example.yaml a un archivo local no versionado (ej. secrets.yaml)
# con tus valores reales de JWT_SECRET y GEMINI_API_KEY, o aplicalo para entorno de demostracion:
kubectl apply -f k8s/apps/secrets.example.yaml
```

### Paso 3: Desplegar infraestructura y aplicaciones
```powershell
# 1. Bases de datos (PostgreSQL x2, MongoDB), Zookeeper y Kafka
kubectl apply -f k8s/infrastructure/databases-and-kafka.yaml

# 2. Job que crea los topics (issues.events, analytics.query, analytics.reply)
kubectl apply -f k8s/infrastructure/kafka-topics-job.yaml

# 3. Microservicios (MS1, MS2, MS3), Agente MCP, BFF Gateway y Frontend Web (2 replicas)
kubectl apply -f k8s/apps/microservices-and-bff.yaml
```

### Paso 4: Verificar estado y acceder
```powershell
kubectl get pods -n jira-ai
kubectl get svc -n jira-ai
```

- Los `initContainers` (`wait-kafka-topics`) esperan automáticamente a que el Job `kafka-init-topics` complete la creación de tópicos antes de arrancar MS1, MS2, MS3 y el BFF.
- El Job `kafka-init-topics` quedará en estado `Completed` (comportamiento esperado).
- Los manifiestos ya resuelven las variables necesarias en clúster (como `DATABASE_URL` en `issues-service` y la limpieza de la variable automática `KAFKA_PORT` inyectada por el servicio `kafka` de Kubernetes).
- Con **Docker Desktop Kubernetes**, los servicios `LoadBalancer` quedan accesibles directamente en:
  - **JIRAN'T Web:** `http://localhost`
  - **BFF GraphQL:** `http://localhost:4000/graphql`

### Detener y limpiar las cargas en Kubernetes
```powershell
kubectl delete -f k8s/apps/microservices-and-bff.yaml `
  -f k8s/infrastructure/databases-and-kafka.yaml `
  -f k8s/infrastructure/kafka-topics-job.yaml `
  --ignore-not-found=true
```
