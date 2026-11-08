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

## 2. Onboarding y Clonación para Colaboradores

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

### Configuración de Variables de Entorno
Copia la plantilla de entorno:
```bash
cp .env.example .env
```
*(Opcional: Añade tu clave `GEMINI_API_KEY` en `.env` para habilitar el agente IA en modo interactivo en vivo).*

### Levantar Todo el Ecosistema (Docker Compose)
Levanta los 11 contenedores (PostgreSQL x2, MongoDB, Kafka, Zookeeper, microservicios, gateway y web):
```bash
docker compose up -d
```

### Endpoints y Puertos Principales
* **Frontend Web:** [http://localhost:5173](http://localhost:5173) (o puerto `:80` en producción)
* **BFF GraphQL Playground:** [http://localhost:4000/graphql](http://localhost:4000/graphql)
* **MCP Agent Health:** [http://localhost:3000/health](http://localhost:3000/health)
* **MS1 Issues (gRPC):** `localhost:50051`
* **MS2 Sprints (gRPC):** `localhost:50052`
* **Apache Kafka Broker:** `localhost:9092` (externo: `localhost:29092`)
* **PostgreSQL Incidencias (MS1):** `localhost:5434` (`issues_db`)
* **PostgreSQL Sprints (MS2):** `localhost:5433` (`sprints_db`)
* **MongoDB Analítica (MS3):** `localhost:27017` (`analytics_db`)

---

## 4. Guía de Desarrollo por Microservicio (Flujo Aislado)

Un desarrollador no necesita compilar o levantar todos los servicios para programar en uno específico.

### Paso 1: Levantar solo la infraestructura de soporte
```bash
docker compose up -d postgres-issues postgres-sprints mongo-analytics kafka zookeeper
```

### Paso 2: Ejecutar el microservicio en modo local
* **MS1 (Go):**
  ```bash
  cd jira-issues-go
  go run cmd/server/main.go
  ```
* **MS2 (NestJS):**
  ```bash
  cd jira-sprints-nestjs
  npm run start:dev
  ```
* **MS3 (.NET 8):**
  ```bash
  cd jira-analytics-dotnet
  dotnet run --project src/JiraAnalytics.Api
  ```
* **BFF Gateway (NestJS GraphQL):**
  ```bash
  cd jira-bff
  npm run start:dev
  ```
* **Frontend Web (React 18):**
  ```bash
  cd jira-web
  npm run dev
  ```

---

## 5. Pruebas y Validación Técnica para Desarrolladores

### Pruebas Unitarias y de Cobertura por Servicio
Cada microservicio cuenta con su propia suite aislada:
* **Go:** `go test -v -coverprofile=coverage.out ./...`
* **NestJS / TypeScript:** `npm test -- --coverage`
* **.NET 8:** `dotnet test --collect:"XPlat Code Coverage"`
* **React Web:** `npm test -- --coverage`

### Pruebas de Endpoints gRPC sin Frontend
Los servicios backend gRPC se pueden probar directamente usando contratos Protobuf (`jira-contracts/proto/`):
* **Postman / Insomnia:** Crear petición de tipo `gRPC`, apuntar a `localhost:50051` o `localhost:50052`, cargar el archivo `.proto` y enviar peticiones directas.
* **grpcurl (Terminal):**
  ```bash
  grpcurl -plaintext -proto ./jira-contracts/proto/issues.proto \
    -d '{"title": "Nueva Incidencia", "project_id": "PROJ-1"}' \
    localhost:50051 jira.issues.v1.IssuesService/CreateIssue
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
