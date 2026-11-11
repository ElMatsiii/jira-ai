# Jira AI — Plataforma Políglota de Microservicios Ágiles (Orquestador)

[![GitHub Organization](https://img.shields.io/badge/GitHub-ElMatsiii-181717.svg?logo=github)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-11_Services-2496ED?logo=docker)]()
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Manifests_Ready-326CE5?logo=kubernetes)]()

Repositorio orquestador del ecosistema distribuido **Jira AI**: microservicios en **Go, TypeScript y C# (.NET 8)** (sin Python), comunicación híbrida con **gRPC** y **Apache Kafka**, API Gateway **GraphQL** en NestJS, **Frontend Web SPA** en React 18, y un **Agente IA Scrum Master** basado en el protocolo **MCP (Model Context Protocol)** y **Google Gemini 2.0 Flash**.

---

## 1. Repositorios de Microservicios

El proyecto está organizado en una arquitectura **multi-repositorio** vinculada mediante submódulos Git:

| # | Repositorio | Stack Tecnológico | Rol / Protocolo | Cobertura |
| :-: | :--- | :--- | :--- | :--- |
| **1** | [**`ElMatsiii/jira-contracts`**](https://github.com/ElMatsiii/jira-contracts) | Protobuf v3 + JSON Schema | Contratos gRPC compartidos y esquemas Kafka | **100.00%** |
| **2** | [**`ElMatsiii/jira-issues-go`**](https://github.com/ElMatsiii/jira-issues-go) | Go 1.22+ (Zero-CGO) + GORM | MS1: Incidencias, gRPC Server (:50051), Kafka Producer | **64.80%** |
| **3** | [**`ElMatsiii/jira-sprints-nestjs`**](https://github.com/ElMatsiii/jira-sprints-nestjs) | TypeScript + NestJS + TypeORM | MS2: Sprints, gRPC Server (:50052), Kafka Req-Reply | **85.99%** |
| **4** | [**`ElMatsiii/jira-analytics-dotnet`**](https://github.com/ElMatsiii/jira-analytics-dotnet) | .NET 8 (C#) Clean Architecture | MS3: Burndown/Métricas, Kafka Worker, gRPC Client | **76.80%** |
| **5** | [**`ElMatsiii/jira-mcp-agent`**](https://github.com/ElMatsiii/jira-mcp-agent) | TypeScript + Gemini 2.0 Flash | AI Scrum Master MCP Server (:3000), estimador | **83.50%** |
| **6** | [**`ElMatsiii/jira-bff`**](https://github.com/ElMatsiii/jira-bff) | TypeScript + NestJS + GraphQL | API Gateway (:4000/graphql), orquestador gRPC/Kafka | **74.23%** |
| **7** | [**`ElMatsiii/jira-web`**](https://github.com/ElMatsiii/jira-web) | React 18 + Vite + TypeScript + Apollo | Frontend Web SPA (Backlog, Kanban, Burndown, AI) | **92.62%** |

> Todos los repositorios superan el umbral requerido de **>= 60% de cobertura de pruebas**.

---

## 2. Requisitos y clonación

Para ejecutar todo el stack localmente necesitas Docker Desktop con el motor Linux y Docker Compose v2. Para la suite mock basta Node.js 22.6 o superior (recomendado: Node.js 24). Para ejecutar servicios fuera de contenedores instala además Go 1.22+, Node.js 20+ y .NET 8 SDK.

Para clonar la plataforma completa con todos los submódulos de microservicios:

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
* **En Windows (PowerShell):**
  ```powershell
  .\clone-all.ps1
  ```
* **En Linux / macOS (Bash):**
  ```bash
  chmod +x ./clone-all.sh
  ./clone-all.sh
  ```

---

## 3. Puesta en Marcha

### Configuración de variables de entorno
En PowerShell:
```powershell
Copy-Item .env.example .env
```
En Linux/macOS:
```bash
cp .env.example .env
```
`GEMINI_API_KEY` es opcional: el agente puede responder usando su fallback local si no configuras una clave.

### Levantar Todo el Ecosistema (Docker Compose)
Desde la raíz del repositorio, construye y levanta los servicios:
```bash
docker compose up --build -d
docker compose ps
```
La primera construcción puede tardar varios minutos. Compose espera a que PostgreSQL, MongoDB y Kafka pasen sus healthchecks antes de arrancar los consumidores. Para ver los logs: `docker compose logs -f`; para apagar el stack sin borrar datos: `docker compose down`.

### Endpoints y Puertos Principales
* **Frontend Web:** [http://localhost:5173](http://localhost:5173) (o puerto `:80` en producción)
* **BFF GraphQL Playground:** [http://localhost:4000/graphql](http://localhost:4000/graphql)
* **MCP Agent Health:** [http://localhost:3000/healthz](http://localhost:3000/healthz)
* **MS1 Issues (gRPC):** `localhost:50051`
* **MS2 Sprints (gRPC):** `localhost:50052`
* **MS3 Analytics Worker (HTTP Health):** [http://localhost:8080/healthz](http://localhost:8080/healthz)
* **Apache Kafka Broker:** `localhost:9092` (externo: `localhost:29092`)
* **PostgreSQL Incidencias (MS1):** `localhost:5434` (`issues_db`)
* **PostgreSQL Sprints (MS2):** `localhost:5433` (`sprints_db`)
* **MongoDB Analítica (MS3):** `localhost:27017` (`analytics_db`)

### Probar el flujo de usuario
1. Abre `http://localhost:5173` y crea una cuenta con nombre, email y una contraseña de al menos 10 caracteres. El registro crea un espacio de trabajo personal.
2. Crea un proyecto con nombre y una clave de 2 a 10 caracteres (por ejemplo, `DEMO`). Los proyectos y sus historias se comparten con los miembros del espacio.
3. Para colaborar, la otra persona primero debe registrarse; luego un propietario o administrador puede agregarla por email desde la barra del espacio. Esta versión no envía invitaciones por correo.
4. En **Backlog**, crea historias, tareas o bugs. La opción de mejora con IA puede proponer puntos de historia y criterios de aceptación; revisa la propuesta antes de guardarla. También puedes usar el panel de IA para desglosar una épica y crear las historias sugeridas.
5. En **Cronograma**, crea un sprint con fechas y objetivo, asigna historias desde el backlog e inicia el sprint. El **Tablero** muestra las historias asignadas al sprint activo.
6. En **Rendimiento**, registra horas por historia y usa **Analizar sprint con IA** para recibir un diagnóstico y recomendaciones. Los registros son tiempo observado, no una estimación; las horas por sí solas no miden productividad ni desviación respecto de lo planificado.

Sin `GEMINI_API_KEY`, las acciones de IA usan el motor heurístico local. Para habilitar Gemini, agrega la clave a `.env` y reconstruye el agente:
```powershell
docker compose up -d --build mcp-agent
```

`JWT_SECRET` firma las sesiones de 12 horas. El valor del `.env.example` es solo para desarrollo local; sustitúyelo por un secreto aleatorio y privado antes de cualquier despliegue no local. No compartas el archivo `.env`.

---

## 4. Guía de Desarrollo por Microservicio (Flujo Aislado)

Un desarrollador no necesita compilar o levantar todos los servicios para programar en uno específico.

### Paso 1: Levantar solo la infraestructura de soporte
```bash
docker compose up -d postgres-issues postgres-sprints mongo-analytics kafka zookeeper
```

### Paso 2: Ejecutar el microservicio en modo local
Para BFF y Sprints, compila primero `jira-contracts` (`npm ci` y `npm run build`) y ejecuta `npm ci` en cada repositorio Node antes de iniciarlo. En esta modalidad local, Kafka se alcanza por el listener publicado `localhost:29092`; dentro de Docker, los servicios usan `kafka:9092`. Ejecuta cada servicio en una terminal separada.

* **MS1 (Go):**
  ```powershell
  Push-Location jira-issues-go
  $env:DATABASE_URL = "postgres://jira_user:jira_password@localhost:5434/issues_db?sslmode=disable"
  $env:KAFKA_BROKERS = "localhost:29092"
  go run cmd/server/main.go
  Pop-Location
  ```
* **MS2 (NestJS):**
  ```powershell
  Push-Location jira-sprints-nestjs
  $env:DB_HOST = "localhost"; $env:DB_PORT = "5433"
  $env:DB_USER = "jira_user"; $env:DB_PASSWORD = "jira_password"; $env:DB_NAME = "sprints_db"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MS1_GRPC_URL = "localhost:50051"
  npm run start:dev
  Pop-Location
  ```
* **MS3 (.NET 8):**
  ```powershell
  Push-Location jira-analytics-dotnet
  $env:MONGODB_URI = "mongodb://localhost:27017"; $env:MONGODB_DATABASE = "analytics_db"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MS2_GRPC_URL = "http://localhost:50052"
  dotnet run --project src/JiraAi.Analytics.Worker
  Pop-Location
  ```
* **Agente MCP:**
  ```powershell
  Push-Location jira-mcp-agent
  npm run dev
  Pop-Location
  ```
* **BFF Gateway (NestJS GraphQL):**
  ```powershell
  Push-Location jira-bff
  $env:ISSUES_GRPC_URL = "localhost:50051"; $env:SPRINTS_GRPC_URL = "localhost:50052"
  $env:KAFKA_BROKERS = "localhost:29092"; $env:MCP_AGENT_URL = "http://localhost:3000"
  npm run start:dev
  Pop-Location
  ```
* **Frontend Web (React 18):**
  ```powershell
  Push-Location jira-web
  npm run dev
  Pop-Location
  ```

---

## 5. Pruebas y Validación Técnica para Desarrolladores

### Pruebas Unitarias y de Cobertura por Servicio
La suite rápida mock no requiere instalar dependencias:
```bash
cd tests/e2e
npm test
```
Esta suite simula los límites de los servicios; no arranca contenedores ni prueba la integración real. Para verificar los servicios levantados con Docker, usa la comprobación smoke más abajo.

Para las pruebas unitarias:
* **Contratos compartidos:** ejecuta `npm ci` y `npm run build` en `jira-contracts` antes de instalar BFF y Sprints (ambos dependen del paquete local generado):
  ```powershell
  Push-Location jira-contracts
  npm ci
  npm run build
  Pop-Location
  ```
* **BFF y Sprints:** desde cada carpeta ejecuta `npm ci`, `npm run test:coverage` y `npm run build`.
* **Agente MCP:** desde `jira-mcp-agent`, ejecuta `npm ci`, `npm run test:coverage` y `npm run build`.
* **Contratos:** desde `jira-contracts`, ejecuta `npm test -- --coverage`.
* **Go:** desde `jira-issues-go`, ejecuta `go test -v -coverprofile=coverage.out ./...`.
* **.NET 8:** desde `jira-analytics-dotnet`, ejecuta `dotnet test tests/JiraAi.Analytics.UnitTests/JiraAi.Analytics.UnitTests.csproj`.
* **React Web:** desde `jira-web`, ejecuta `npm ci`, `npm test` y `npm run build`.

### Verificación del stack Docker en vivo
Con los contenedores arriba, desde `tests/e2e` ejecuta:
```bash
npm run smoke:live
```
Verifica que la web responda, que el BFF acepte una consulta GraphQL y que el agente MCP responda en `/healthz`. No reemplaza pruebas de flujos de negocio. Para comprobar manualmente:
```powershell
Invoke-RestMethod http://localhost:3000/healthz
Invoke-RestMethod -Uri http://localhost:4000/graphql -Method Post -ContentType 'application/json' -Body '{"query":"{ __typename }"}'
```

### Pruebas de Endpoints gRPC sin Frontend
Los servicios backend gRPC se pueden probar directamente usando contratos Protobuf (`jira-contracts/protos/`):
* **Postman / Insomnia:** Crear petición de tipo `gRPC`, apuntar a `localhost:50051` o `localhost:50052`, cargar el archivo `.proto` y enviar peticiones directas.
* **grpcurl (Terminal):**
  ```bash
  grpcurl -plaintext -proto ./jira-contracts/protos/issues.proto \
    -d '{"title": "Nueva Incidencia", "project_id": "PROJ-1"}' \
    localhost:50051 jira.issues.v1.IssueService/CreateIssue
  ```

### Verificación de Eventos en Apache Kafka
Para inspeccionar eventos de dominio en vivo:
```bash
docker exec -it jira-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic issues.events \
  --from-beginning
```

### Suite de Pruebas de Extremo a Extremo (E2E Opaque-Box)
El repositorio incluye una suite E2E completa en `tests/e2e`:
```bash
cd tests/e2e
npm test
```

---

## 6. Despliegue en Kubernetes (K8s)

Para desplegar en un clúster local (Minikube, Kind o Docker Desktop K8s):
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/infrastructure/databases-and-kafka.yaml
kubectl apply -f k8s/apps/microservices-and-bff.yaml
```
Estos manifiestos sirven como base de demostración; aún requieren persistencia duradera para las bases de datos, gestión de secretos y probes antes de considerarse listos para producción. Para probar todo localmente, se recomienda Docker Compose.
