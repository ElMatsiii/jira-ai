# Original User Request

## Initial Request — 2026-10-27T05:59:32Z

Construir la plataforma distribuida completa Jira AI compuesta por 7 repositorios independientes: contratos compartidos (.proto/Kafka), 3 microservicios políglotas (Go, TypeScript/NestJS, C#/.NET 8, sin Python), BFF en NestJS (GraphQL), Agente de IA con MCP Server (Google Gemini 2.0 Flash), frontend móvil en React Native (Expo), orquestación en Kubernetes (K8s) y Docker Compose, con pipelines de CI/CD que garanticen al menos un 60% de cobertura de pruebas.

Working directory: C:\jira-ai
Integrity mode: development

## Requirements

### R1. Central Contracts Repository (jira-contracts)
- Define .proto contracts for Issues (issues.proto) and Sprints (sprints.proto).
- Define JSON event schemas for Kafka topics (issues.events, analytics.query, analytics.reply).
- Provide automated scripts/tooling to compile stubs for Go, TypeScript and C#.

### R2. Polyglot Microservices & Database-per-Service
- MS1 (Issues & Projects) in Go: gRPC server (:50051), PostgreSQL persistence (issues_db), produces issues.events to Kafka.
- MS2 (Sprints & Planning) in TypeScript (NestJS): gRPC server (:50052), acts as gRPC client to Go and Kafka client to .NET, PostgreSQL persistence (sprints_db).
- MS3 (Analytics & Metrics) in C# (.NET 8/9): Kafka background worker/consumer, acts as gRPC client to NestJS, MongoDB persistence (analytics_db).
- Strict Interoperability Rule: Calls from one microservice to another must use the target microservice's protocol, and map responses to the local protocol format.

### R3. AI Scrum Master via MCP Server (jira-mcp-agent)
- Implemented in TypeScript / Node.js using @modelcontextprotocol/sdk and Google Gemini 2.0 Flash (strictly NO Python).
- Exposes REST endpoints (/agent/decompose-epic, /agent/plan-sprint, /agent/diagnose-metrics).
- Includes MCP tools: story estimation, Gherkin acceptance criteria generator, capacity balancing.

### R4. BFF API Gateway (jira-bff)
- Built in TypeScript (NestJS) exposing a unified GraphQL API (/graphql).
- Orchestrates client calls by invoking MS1 and MS2 via gRPC, MS3 via Kafka, and MCP Agent via REST.

### R5. Mobile Frontend (jira-mobile)
- Built in React Native (Expo) with TypeScript and Apollo Client.
- Features: Backlog view with AI breakdown trigger, Scrum Board, Burndown & Analytics screen, AI Assistant modal.

### R6. Infrastructure, K8s & CI/CD Pipelines
- Root docker-compose.yml for local execution (Postgres x2, Mongo, Kafka, Zookeeper, and services).
- Native Kubernetes manifests (k8s/) with Deployment and Service resources for each component.
- GitHub Actions CI workflows in each repository enforcing a minimum of 60% automated test coverage (cov 60%).

## Acceptance Criteria

### Interoperability & Architecture
- [ ] MS2 (NestJS) communicates with MS1 (Go) via gRPC and maps the response to its internal model.
- [ ] MS2 (NestJS) communicates with MS3 (.NET) via Kafka Request-Reply and maps the response to its internal model.
- [ ] MS3 (.NET) invokes MS2 (NestJS) via gRPC client when triggering alerts.
- [ ] BFF handles GraphQL queries and mutations by routing to the appropriate underlying protocols.
- [ ] MCP Server responds to REST endpoints with structured JSON (User Stories in Gherkin, Sprint plans).

### Quality & Testing
- [ ] Unit test suites in each service execute and achieve >= 60% code coverage.
- [ ] CI pipeline definitions validate the 60% coverage threshold and fail if below.
- [ ] Docker Compose boots all databases and services successfully with healthy status.
