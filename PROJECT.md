# Project: Jira AI Distributed Platform

## Architecture

The Jira AI platform is a distributed, polyglot enterprise agile project management system composed of 7 independent repositories, local container orchestration via Docker Compose, and native Kubernetes deployment manifests.

```
                      ┌────────────────────────────────────────────────┐
                      │              jira-web (React 18)               │
                      │  React 18 + Vite SPA, Apollo Client, TypeScript │
                      │  (Backlog, Scrum Board, Burndown, AI Drawer)   │
                      └───────────────────────┬────────────────────────┘
                                              │ GraphQL (HTTP / :4000)
                                              ▼
                      ┌────────────────────────────────────────────────┐
                      │               jira-bff (NestJS)                │
                      │  Unified GraphQL API Gateway (/graphql)        │
                      └────┬───────────────┬───────────────┬───────┬───┘
                           │               │               │       │
             gRPC (:50051) │ gRPC (:50052) │ Kafka R-R     │       │ HTTP REST (:3000)
                           ▼               ▼               ▼       ▼
    ┌───────────────────────────┐  ┌─────────────────┐ ┌───────────────┐ ┌─────────────────────────┐
    │  MS1: jira-issues-go      │  │MS2: jira-sprints│ │MS3: jira-     │ │ jira-mcp-agent          │
    │  Go 1.22+, gRPC Server    │  │NestJS, gRPC Svr │ │analytics-     │ │ TypeScript/Node.js      │
    │  PostgreSQL (issues_db)   │  │Postgres(sprints)│ │dotnet (.NET 8)│ │ Gemini 2.0 Flash + MCP  │
    └─────────────┬─────────────┘  └────────┬────────┘ │Mongo(analytics│ └─────────────────────────┘
                  │                         │          └───────┬───────┘
                  │ Publishes issues.events │                  │
                  ▼                         │                  │
    ┌───────────────────────────────────────┴──────────────────┴───────────────────────────────────┐
    │                                  Apache Kafka + Zookeeper                                    │
    │ Topics: issues.events (Pub/Sub), analytics.query (Req), analytics.reply (Resp)              │
    └──────────────────────────────────────────────────────────────────────────────────────────────┘
                                  ▲ (MS2 queries MS3 via Kafka R-R)
                                  │ (MS3 alerts MS2 via gRPC :50052)
```

### Strict Interoperability Topology
1. **MS2 (NestJS) -> MS1 (Go)**: Synchronous gRPC over HTTP/2 (:50051) using `issues.proto`. Validates issues and executes batch sprint assignments. Maps protobuf to NestJS domain entities.
2. **MS2 (NestJS) -> MS3 (.NET)**: Asynchronous Kafka Request-Reply over topic `analytics.query` and `analytics.reply` using standard `kafka_correlationId` message header and 5000ms timeout guard.
3. **MS3 (.NET) -> MS2 (NestJS)**: Synchronous gRPC over HTTP/2 (:50052) using `sprints.proto` (`AlertService.TriggerSprintAlert`) for automated risk notifications (scope creep, bottleneck alerts).
4. **MS1 (Go) -> Kafka**: Asynchronous domain event producer emitting `issues.events` on issue creation, updates, and status transitions.
5. **BFF (NestJS) -> Services**:
   - MS1 (Go) via gRPC (:50051) for issue CRUD queries/mutations.
   - MS2 (NestJS) via gRPC (:50052) for sprint management queries/mutations.
   - MS3 (.NET) via Kafka Request-Reply (`analytics.query` -> `analytics.reply`) for burndown & velocity metrics.
   - MCP Agent (TypeScript) via HTTP REST (:3000) for AI epic decomposition, sprint planning, and metric diagnosis.
6. **Web (React 18 SPA) -> BFF**: Apollo Client executing GraphQL queries and mutations over `/graphql`.

---

## Feature Inventory

Every feature across all repositories, infrastructure, and CI/CD pipelines is enumerated below with strict milestone ownership:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `issues.proto` Contract | Protobuf contract for Issue and Project entities, CRUD RPCs, and batch sprint assignment | M1 | Survey |
| 2 | `sprints.proto` Contract | Protobuf contract for Sprint entity, lifecycle RPCs, and AlertService for cross-service alerts | M1 | Survey |
| 3 | `issues.events.json` Schema | Kafka JSON schema for Issue domain events (CREATED, UPDATED, STATUS_CHANGED, DELETED) | M1 | Survey |
| 4 | `analytics.query.json` Schema | Kafka JSON schema for analytics queries with correlationId, queryType, and sprintId | M1 | Survey |
| 5 | `analytics.reply.json` Schema | Kafka JSON schema for analytics responses with correlationId, burndown data, and velocity | M1 | Survey |
| 6 | Contracts Tooling & Generation | Automated generation scripts for Go, TypeScript, and C# stubs + schema validators | M1 | Survey |
| 7 | Contracts Test Suite & CI | Unit tests for schema validation and CI workflow enforcing >= 60% coverage | M1 | Survey |
| 8 | MS1 Go Domain & Models | Issue and Project domain entities, state transitions, and validation logic | M2 | Survey |
| 9 | MS1 Go Database Persistence | PostgreSQL `issues_db` repository with connection pooling, migrations, and transactions | M2 | Survey |
| 10 | MS1 Go gRPC Server | gRPC handler on :50051 implementing IssueService (Create, Get, List, UpdateStatus, BatchUpdate) | M2 | Survey |
| 11 | MS1 Go Kafka Event Producer | Producer publishing domain events to `issues.events` on issue mutations | M2 | Survey |
| 12 | MS1 Go Test Suite & CI | Unit tests achieving >= 60% test coverage and GitHub Actions workflow asserting threshold | M2 | Survey |
| 13 | MS2 NestJS Domain & Models | Sprint domain entities, lifecycle states (PLANNED, ACTIVE, COMPLETED), and alert models | M3 | Survey |
| 14 | MS2 NestJS Database Persistence | PostgreSQL `sprints_db` repository using TypeORM/Prisma with migrations | M3 | Survey |
| 15 | MS2 NestJS gRPC Server | gRPC server on :50052 implementing SprintService and AlertService (`TriggerSprintAlert`) | M3 | Survey |
| 16 | MS2 NestJS gRPC Client to MS1 | gRPC client invoking MS1 (:50051) to fetch and validate issues for sprints | M3 | Survey |
| 17 | MS2 NestJS Kafka R-R Client | Kafka client sending `analytics.query` and awaiting `analytics.reply` with correlationId | M3 | Survey |
| 18 | MS2 NestJS Test Suite & CI | Unit tests achieving >= 60% coverage and GitHub Actions workflow asserting threshold | M3 | Survey |
| 19 | MS3 .NET Domain & Models | Analytics domain models, burndown calculations, velocity history, and alert definitions | M4 | Survey |
| 20 | MS3 .NET MongoDB Persistence | MongoDB `analytics_db` driver, collections (`sprint_snapshots`, `velocity_history`), and indexes | M4 | Survey |
| 21 | MS3 .NET Kafka Issues Consumer | Consumer processing `issues.events` to maintain real-time burndown snapshots | M4 | Survey |
| 22 | MS3 .NET Kafka Query Responder | Worker consuming `analytics.query` and publishing structured reply to `analytics.reply` | M4 | Survey |
| 23 | MS3 .NET gRPC Client to MS2 | gRPC client calling MS2 (:50052) AlertService when scope creep or velocity risks are detected | M4 | Survey |
| 24 | MS3 .NET Test Suite & CI | Unit tests achieving >= 60% coverage with Coverlet and GitHub Actions workflow | M4 | Survey |
| 25 | MCP Agent Core & SDK | TypeScript/Node.js setup with `@modelcontextprotocol/sdk` (Strictly NO Python) | M5 | Survey |
| 26 | MCP Agent Gemini 2.0 Integration| Google Gemini 2.0 Flash integration with offline heuristic rule engine for CI fallback | M5 | Survey |
| 27 | MCP Agent REST Endpoints | Express/Fastify REST endpoints (`/agent/decompose-epic`, `/agent/plan-sprint`, `/agent/diagnose-metrics`)| M5 | Survey |
| 28 | MCP Agent Registered Tools | MCP tools: story estimation, Gherkin acceptance criteria generator, capacity balancing | M5 | Survey |
| 29 | MCP Agent Test Suite & CI | Unit tests achieving >= 60% coverage with Jest and GitHub Actions workflow | M5 | Survey |
| 30 | BFF NestJS GraphQL Gateway | NestJS GraphQL gateway on :4000 exposing unified `/graphql` schema | M6 | Survey |
| 31 | BFF NestJS gRPC Clients | gRPC clients connecting to MS1 (:50051) and MS2 (:50052) for Issue & Sprint resolvers | M6 | Survey |
| 32 | BFF NestJS Kafka R-R Client | Kafka client dispatching `analytics.query` to MS3 and resolving GraphQL analytics types | M6 | Survey |
| 33 | BFF NestJS REST MCP Client | HTTP client calling MCP Agent REST endpoints for AI mutations (`decomposeEpic`, `planSprint`) | M6 | Survey |
| 34 | BFF NestJS Test Suite & CI | Unit tests achieving >= 60% coverage with Jest and GitHub Actions workflow | M6 | Survey |
| 35 | Web SPA React 18 App Setup | React 18 + Vite SPA project structure with TypeScript and Dev-Tool styling | M7 | Survey |
| 36 | Web Apollo Client Integration| Apollo Client configured to communicate with BFF `/graphql` | M7 | Survey |
| 37 | Web Backlog View | Interactive Backlog view with issue filtering and AI Epic Breakdown trigger | M7 | Survey |
| 38 | Web Scrum Board View | 4-column Scrum board (TODO, IN_PROGRESS, IN_REVIEW, DONE) with card status updates | M7 | Survey |
| 39 | Web Burndown & Analytics UI | SVG Burndown chart visualization, velocity metrics, and microservice status | M7 | Survey |
| 40 | Web AI Assistant Drawer | Scrum Master drawer providing Gemini 2.0 Flash decomposition and Gherkin criteria | M7 | Survey |
| 41 | Web Test Suite & CI | Component & unit tests achieving >= 60% coverage (92.62%) with Jest and CI workflow | M7 | Survey |
| 42 | Root Docker Compose | Complete `docker-compose.yml` orchestrating Postgres x2, Mongo, Kafka, Zookeeper, and 6 services | M8 | Survey |
| 43 | Native Kubernetes Manifests | Complete `k8s/` manifests with Deployments, Services, ConfigMaps, and Secrets | M8 | Survey |
| 44 | CI/CD Workflows Verification | Verification of GitHub Actions workflows in all 7 repos enforcing >= 60% coverage | M9 | Survey |
| 45 | End-to-End Test Suite | End-to-end integration tests verifying all cross-service communication flows | M9 | Survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | `jira-contracts` | Protobuf contracts (`issues.proto`, `sprints.proto`), Kafka JSON schemas (`issues.events`, `analytics.query`, `analytics.reply`), compilation scripts, schema validation tests, CI workflow | none | DONE |
| M2 | `jira-issues-go` (MS1) | Go gRPC server (:50051), PostgreSQL (`issues_db`) persistence, Kafka producer (`issues.events`), unit tests (>= 60%), CI workflow, Dockerfile | M1 | DONE |
| M3 | `jira-sprints-nestjs` (MS2) | NestJS gRPC server (:50052), PostgreSQL (`sprints_db`) persistence, gRPC client to MS1, Kafka R-R client to MS3, AlertService, unit tests (>= 60%), CI workflow, Dockerfile | M1, M2 | DONE |
| M4 | `jira-analytics-dotnet` (MS3)| C# .NET 8 worker, MongoDB (`analytics_db`) persistence, Kafka consumer/responder, gRPC client to MS2 (:50052), unit tests (>= 60%), CI workflow, Dockerfile | M1, M3 | DONE |
| M5 | `jira-mcp-agent` | TypeScript/Node.js MCP agent (NO Python), Gemini 2.0 Flash SDK + offline mock fallback, REST endpoints, MCP tools, unit tests (>= 60%), CI workflow, Dockerfile | none | IN_PROGRESS |
| M6 | `jira-bff` | NestJS GraphQL gateway (:4000), gRPC clients to MS1/MS2, Kafka client to MS3, REST client to MCP agent, unit tests (>= 60%), CI workflow, Dockerfile | M1, M2, M3, M4, M5 | PLANNED |
| M7 | `jira-web` | React 18 + Vite SPA, Apollo Client, Backlog, Scrum Board, Burndown & Analytics, AI Assistant Drawer, unit tests (>= 60%), CI workflow, Nginx Dockerfile | M6 | DONE |
| M8 | Infrastructure & K8s | Root `docker-compose.yml` (databases, Kafka, all services), native Kubernetes manifests in `k8s/` | M1..M7 | PLANNED |
| M9 | E2E Integration & Final Audit | End-to-end integration verification, validation of all cross-service flows, coverage verification (>= 60% across all repos) | M1..M8 | PLANNED |

---

## Interface Contracts

### 1. `issues.proto` (`jira.issues.v1`)
```protobuf
syntax = "proto3";
package jira.issues.v1;
option go_package = "jira-contracts/gen/go/issues/v1;issuesv1";
option csharp_namespace = "JiraAi.Contracts.Issues.V1";

enum IssueStatus {
  ISSUE_STATUS_UNSPECIFIED = 0;
  ISSUE_STATUS_TODO = 1;
  ISSUE_STATUS_IN_PROGRESS = 2;
  ISSUE_STATUS_IN_REVIEW = 3;
  ISSUE_STATUS_DONE = 4;
}

enum IssuePriority {
  ISSUE_PRIORITY_UNSPECIFIED = 0;
  ISSUE_PRIORITY_LOW = 1;
  ISSUE_PRIORITY_MEDIUM = 2;
  ISSUE_PRIORITY_HIGH = 3;
  ISSUE_PRIORITY_CRITICAL = 4;
}

enum IssueType {
  ISSUE_TYPE_UNSPECIFIED = 0;
  ISSUE_TYPE_STORY = 1;
  ISSUE_TYPE_TASK = 2;
  ISSUE_TYPE_BUG = 3;
  ISSUE_TYPE_EPIC = 4;
}

message Issue {
  string id = 1;
  string key = 2;
  string project_id = 3;
  string title = 4;
  string description = 5;
  IssueStatus status = 6;
  IssuePriority priority = 7;
  IssueType type = 8;
  int32 story_points = 9;
  string sprint_id = 10;
  string assignee_id = 11;
  string reporter_id = 12;
  string acceptance_criteria = 13;
  int64 created_at = 14;
  int64 updated_at = 15;
}

service IssueService {
  rpc CreateIssue(CreateIssueRequest) returns (CreateIssueResponse);
  rpc GetIssue(GetIssueRequest) returns (GetIssueResponse);
  rpc ListIssues(ListIssuesRequest) returns (ListIssuesResponse);
  rpc UpdateIssueStatus(UpdateIssueStatusRequest) returns (UpdateIssueStatusResponse);
  rpc BatchUpdateIssueSprint(BatchUpdateIssueSprintRequest) returns (BatchUpdateIssueSprintResponse);
}
```

### 2. `sprints.proto` (`jira.sprints.v1`)
```protobuf
syntax = "proto3";
package jira.sprints.v1;
option go_package = "jira-contracts/gen/go/sprints/v1;sprintsv1";
option csharp_namespace = "JiraAi.Contracts.Sprints.V1";

enum SprintStatus {
  SPRINT_STATUS_UNSPECIFIED = 0;
  SPRINT_STATUS_PLANNED = 1;
  SPRINT_STATUS_ACTIVE = 2;
  SPRINT_STATUS_COMPLETED = 3;
  SPRINT_STATUS_CANCELLED = 4;
}

enum AlertType {
  ALERT_TYPE_UNSPECIFIED = 0;
  ALERT_TYPE_SCOPE_CREEP = 1;
  ALERT_TYPE_VELOCITY_DEFICIT = 2;
  ALERT_TYPE_BOTTLENECK_DETECTED = 3;
}

enum AlertSeverity {
  ALERT_SEVERITY_UNSPECIFIED = 0;
  ALERT_SEVERITY_INFO = 1;
  ALERT_SEVERITY_WARNING = 2;
  ALERT_SEVERITY_CRITICAL = 3;
}

message Sprint {
  string id = 1;
  string project_id = 2;
  string name = 3;
  string goal = 4;
  int64 start_date = 5;
  int64 end_date = 6;
  SprintStatus status = 7;
  int32 total_story_points = 8;
  int32 completed_story_points = 9;
  int64 created_at = 10;
  int64 updated_at = 11;
}

service SprintService {
  rpc CreateSprint(CreateSprintRequest) returns (CreateSprintResponse);
  rpc GetSprint(GetSprintRequest) returns (GetSprintResponse);
  rpc ListSprints(ListSprintsRequest) returns (ListSprintsResponse);
  rpc StartSprint(StartSprintRequest) returns (StartSprintResponse);
  rpc CompleteSprint(CompleteSprintRequest) returns (CompleteSprintResponse);
}

service AlertService {
  rpc TriggerSprintAlert(TriggerSprintAlertRequest) returns (TriggerSprintAlertResponse);
}
```

### 3. Kafka Topics & Correlation Protocol
- **`issues.events`**: Key=`issue.id`. Value=Envelope with `eventId`, `eventType` (`ISSUE_CREATED`, `ISSUE_UPDATED`, `ISSUE_STATUS_CHANGED`, `ISSUE_DELETED`), `timestamp`, and `payload`.
- **`analytics.query`**: Key=`sprintId`. Headers: `kafka_correlationId`, `kafka_replyTopic` (`analytics.reply`). Value=JSON with `queryId`, `correlationId`, `sprintId`, `queryType`.
- **`analytics.reply`**: Key=`sprintId`. Headers: `kafka_correlationId`. Value=JSON with `replyId`, `correlationId`, `sprintId`, `velocity`, `healthScore`, `burndownData`, `diagnostics`.

### 4. MCP Agent REST Protocol
- `POST /agent/decompose-epic`: Body: `{ epicTitle, epicDescription, projectKey }` -> Output: `{ epicTitle, stories: [{ title, description, type, priority, estimatedStoryPoints, acceptanceCriteriaGherkin }] }`
- `POST /agent/plan-sprint`: Body: `{ sprintGoal, teamCapacityStoryPoints, candidateIssues }` -> Output: `{ allocatedStoryPoints, capacityUtilizationPercent, recommendedIssueIds, riskAssessment, rationale }`
- `POST /agent/diagnose-metrics`: Body: `{ sprintId, sprintName, burndownData, blockedIssuesCount }` -> Output: `{ healthStatus, diagnosis, rootCauses, actionableRecommendations }`

### 5. BFF GraphQL Schema (`/graphql`)
- Unified schema exposing `Query.issue`, `Query.issues`, `Query.sprint`, `Query.sprints`, `Query.sprintAnalytics`.
- Mutations: `createIssue`, `updateIssueStatus`, `createSprint`, `startSprint`, `completeSprint`, `decomposeEpic`, `planSprint`, `diagnoseSprint`.

---

## Code Layout

```
C:\jira-ai\
├── jira-contracts/            # Shared Protobufs, JSON schemas, compilation scripts
├── jira-issues-go/            # MS1: Go gRPC server (:50051), Postgres, Kafka producer
├── jira-sprints-nestjs/       # MS2: NestJS gRPC server (:50052), Postgres, gRPC client to MS1, Kafka R-R
├── jira-analytics-dotnet/     # MS3: C# .NET 8 worker, MongoDB, Kafka consumer/responder, gRPC client to MS2
├── jira-mcp-agent/            # TypeScript/Node.js MCP Agent (:3000), Gemini 2.0 Flash + mock fallback
├── jira-bff/                  # NestJS GraphQL Gateway (:4000), gRPC/Kafka/REST orchestration
├── jira-web/                  # React 18 + Vite SPA, Apollo Client, Nginx container (:5173, :80)
├── k8s/                       # Native Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets)
├── docker-compose.yml         # Local orchestration for all DBs, Kafka, Zookeeper, and services
├── ORIGINAL_REQUEST.md        # Authoritative user requirements
├── PROJECT.md                 # Global project architecture, milestones, interface contracts
└── .agents/                   # Teamwork agent metadata & handoffs
```
