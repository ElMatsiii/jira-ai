# Jira AI Distributed Platform: Opaque-Box E2E Test Infrastructure & Specification

## 1. Executive Summary & Testing Philosophy

The Jira AI Distributed Platform is an enterprise-grade, polyglot agile project management suite spanning 7 repositories:
1. `jira-contracts` (Shared Protobuf & Kafka event definitions)
2. `jira-issues-go` (MS1: Go 1.22+, gRPC :50051, PostgreSQL `issues_db`)
3. `jira-sprints-nestjs` (MS2: NestJS, gRPC :50052, PostgreSQL `sprints_db`)
4. `jira-analytics-dotnet` (MS3: C# .NET 8, MongoDB `analytics_db`, Kafka worker)
5. `jira-mcp-agent` (TypeScript/Node.js, Model Context Protocol, Gemini 2.0 Flash)
6. `jira-bff` (NestJS GraphQL Gateway :4000, unified schema)
7. `jira-mobile` (React Native Expo, Apollo Client)
Plus Root `docker-compose.yml`, native Kubernetes manifests in `k8s/`, and multi-repo CI/CD workflows.

### 1.1 Opaque-Box (Black-Box) Testing Principles
- **Zero Internal Coupling**: Tests interact strictly through externally observable boundaries:
  - **GraphQL Gateway**: HTTP POST to `/graphql` on port 4000 (Queries, Mutations, Subscriptions).
  - **REST Endpoints**: HTTP POST to `/agent/*` on port 3000 (MCP Agent).
  - **gRPC Services**: HTTP/2 wire protocol on ports 50051 (`IssueService`) and 50052 (`SprintService`, `AlertService`).
  - **Kafka Event Streaming**: Consumer/Producer assertions on topics `issues.events`, `analytics.query`, and `analytics.reply`.
- **Requirement-Driven Verification**: Test assertions are derived directly from `ORIGINAL_REQUEST.md` and `PROJECT.md` specifications, mathematical properties (burndown velocity slopes, story point capacity sums), and JSON/Protobuf schemas.
- **Progressive Testability & Determinism**: Tests are executable in both:
  1. *Standalone Mock Mode*: Zero-dependency local harness verifying integration contract logic and end-to-end multi-step flows immediately.
  2. *Live Cluster Mode*: Validates real containers orchestrated via Docker Compose or Kubernetes manifests.

---

## 2. Test Design Methodologies

### 2.1 Category-Partition Method (TSL)
Inputs and system environments are divided into functional categories and equivalence classes:
- **Issue Domains**: Status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`), Priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), Type (`STORY`, `TASK`, `BUG`, `EPIC`), Story Points (0..100).
- **Sprint Domains**: Status (`PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`), Duration (1..30 days), Story Point Cap (1..500 pts).
- **Analytics Domains**: Query Types (`BURNDOWN_SERIES`, `VELOCITY_METRICS`, `SPRINT_HEALTH`), Risk Severities (`INFO`, `WARNING`, `CRITICAL`), Alert Types (`SCOPE_CREEP`, `VELOCITY_DEFICIT`, `BOTTLENECK_DETECTED`).
- **AI Agent Domains**: Prompt Complexity, Context Size, Tool Invocations, Network Degradation (Online Gemini vs Offline Rule-Engine Fallback).

### 2.2 Boundary Value Analysis (BVA)
Test cases systematically target extremities and boundary conditions:
- **Numerical Boundaries**: Story Points (`0`, `1`, `99`, `100`, `101`, `NaN`, Negative), Date timestamps (`start_date == end_date`, `end_date < start_date`, Unix epoch zero, far future `year 2038+`).
- **Text & Payload Boundaries**: Empty strings (`""`), single character (`"a"`), maximum character lengths (e.g. 255-char title, 65,535-char description), multi-byte UTF-8, emoji strings (`"🚀 Agile Sprint 🎯"`), format-specific characters (JSON quotation escapes, SQL injection signatures, proto field tag collisions).
- **Network & Concurrency Boundaries**: Zero timeout (`timeoutMs: 0`), Kafka 5000ms correlation guard limit (`4999ms`, `5001ms`), duplicate correlation IDs, simultaneous concurrent status transitions.

### 2.3 Pairwise (Combinatorial) Testing
Pairwise combinations test orthogonal factor interactions to guarantee that all 2-way interactions between parameters (Status × Priority × Type × Sprint State × Notification Channel) are exercised without requiring exponential brute-force test counts.

### 2.4 Real-World Workload Scenarios
Multi-service orchestration flows exercising the entire enterprise lifecycle under realistic team operations, including error recovery, scope inflation, and offline fallbacks.

---

## 3. Tiered Coverage Architecture & Thresholds

| Test Tier | Focus & Definition | Minimum Target Threshold |
|:---|:---|:---|
| **Tier 1** | **Core Feature Coverage**: Primary happy-path functional requirements, contract RPCs, REST routes, and GraphQL operations. | **$\ge 5$ test cases per feature** (Total: $\ge 225$ test cases across all 45 features) |
| **Tier 2** | **Boundary & Adversarial Cases**: BVA limits, invalid combinations, timeout triggers, schema violations, payload extremes. | **$\ge 5$ test cases per feature** (Total: $\ge 225$ test cases across all 45 features) |
| **Tier 3** | **Cross-Feature Pairwise Combinations**: Multi-service combinatorial matrix exercising cross-service interfaces and protocol conversions. | **$\ge 25$ combinatorial test interactions** covering all cross-service protocol boundaries |
| **Tier 4** | **Real-World Workload Scenarios**: Full end-to-end operational stories connecting mobile, BFF, MS1, MS2, MS3, and MCP Agent. | **$\ge 5$ comprehensive multi-step workflows** |

---

## 4. Complete Feature Inventory & Test Catalog (Features 1 to 45)

Each feature from `PROJECT.md` is enumerated below with 5 Tier-1 functional test cases and 5 Tier-2 boundary/adversarial test cases.

```
========================================================================================
FEATURE CATALOG: 45 FEATURES x (5 Tier-1 + 5 Tier-2) = 450 SYSTEMATIC TEST SPECIFICATIONS
========================================================================================
```

### Module 1: `jira-contracts` (Features 1 - 7)

#### Feature 1: `issues.proto` Contract
- **Milestone**: M1 | **Interface**: Protobuf Service `jira.issues.v1.IssueService`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F1-01`: Issue creation message serialization with all valid fields (`title`, `key`, `type=STORY`, `priority=HIGH`, `story_points=5`).
  2. `T1-F1-02`: Retrieve issue RPC message deserialization matching proto definition with populated IDs and timestamps.
  3. `T1-F1-03`: `ListIssuesRequest` filtering by `project_id` and `sprint_id` returning strongly-typed `repeated Issue`.
  4. `T1-F1-04`: `UpdateIssueStatusRequest` transition from `ISSUE_STATUS_TODO` to `ISSUE_STATUS_IN_PROGRESS`.
  5. `T1-F1-05`: `BatchUpdateIssueSprintRequest` updating sprint IDs for a list of multiple issue UUIDs.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F1-01`: Unknown enum values in proto stream (`IssueStatus: 999`) handled with `ISSUE_STATUS_UNSPECIFIED`.
  2. `T2-F1-02`: Zero-value story points (`0`) serialized distinctly from missing or unset fields.
  3. `T2-F1-03`: Large payload test: Issue `description` containing 64KB of UTF-8 multi-byte characters.
  4. `T2-F1-04`: Empty string for mandatory proto field `title` rejected with gRPC `INVALID_ARGUMENT`.
  5. `T2-F1-05`: Boundary value `story_points: 2147483647` (int32 max) handled without buffer overflow.

#### Feature 2: `sprints.proto` Contract
- **Milestone**: M1 | **Interface**: Protobuf Services `SprintService` & `AlertService`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F2-01`: `CreateSprintRequest` with name, goal, start_date, and end_date serializes correctly.
  2. `T1-F2-02`: `StartSprintRequest` transition sprint status to `SPRINT_STATUS_ACTIVE`.
  3. `T1-F2-03`: `CompleteSprintRequest` transitioning sprint status to `SPRINT_STATUS_COMPLETED`.
  4. `T1-F2-04`: `TriggerSprintAlertRequest` carrying `ALERT_TYPE_SCOPE_CREEP` with `ALERT_SEVERITY_WARNING`.
  5. `T1-F2-05`: `ListSprintsRequest` by `project_id` returning ordered list of Sprints.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F2-01`: Start date strictly equal to end date (`start_date == end_date`) yields schema validation error.
  2. `T2-F2-02`: Inverted dates (`end_date < start_date`) rejected with gRPC `INVALID_ARGUMENT`.
  3. `T2-F2-03`: Alert payload containing empty message string handled gracefully with default alert title.
  4. `T2-F2-04`: Negative Unix timestamp for sprint creation rejected.
  5. `T2-F2-05`: Rapid successive calls to `CompleteSprintRequest` on already completed sprint return idempotent status.

#### Feature 3: `issues.events.json` Schema
- **Milestone**: M1 | **Interface**: Kafka JSON Schema on `issues.events`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F3-01`: Validate event envelope with eventType `ISSUE_CREATED` against JSON Schema Draft-07.
  2. `T1-F3-02`: Validate event envelope with eventType `ISSUE_UPDATED` containing modified issue payload.
  3. `T1-F3-03`: Validate event envelope with eventType `ISSUE_STATUS_CHANGED` including previous and new status.
  4. `T1-F3-04`: Validate event envelope with eventType `ISSUE_DELETED` carrying issue UUID.
  5. `T1-F3-05`: Check required metadata fields: `eventId` (UUIDv4), `timestamp` (ISO-8601), and `producerId`.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F3-01`: Event missing required top-level property `payload` fails JSON schema validation.
  2. `T2-F3-02`: Malformed timestamp string (`"invalid-date"`) fails date-time format validator.
  3. `T2-F3-03`: Non-UUID string for `eventId` fails regex/format validation.
  4. `T2-F3-04`: Additional undeclared properties rejected when `additionalProperties: false` is enforced.
  5. `T2-F3-05`: Payload with null value in non-nullable property `issueId` fails validation.

#### Feature 4: `analytics.query.json` Schema
- **Milestone**: M1 | **Interface**: Kafka JSON Schema on `analytics.query`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F4-01`: Validate query for `BURNDOWN_SERIES` containing valid `sprintId` and `correlationId`.
  2. `T1-F4-02`: Validate query for `VELOCITY_METRICS` with team identifier and timeframe.
  3. `T1-F4-03`: Validate query for `SPRINT_HEALTH` summary request.
  4. `T1-F4-04`: Validate Kafka header compliance: presence of `kafka_correlationId` header.
  5. `T1-F4-05`: Validate presence of `replyTopic: "analytics.reply"` attribute.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F4-01`: Query message exceeding 10KB size limit rejected by schema validator.
  2. `T2-F4-02`: Missing `correlationId` field fails mandatory schema constraint.
  3. `T2-F4-03`: Unrecognized `queryType: "UNKNOWN_TYPE"` fails enum constraint.
  4. `T2-F4-04`: Empty string `sprintId: ""` rejected by minLength constraint.
  5. `T2-F4-05`: Injection attack payload in `sprintId` (SQL/NoSQL special characters) safely handled by strict regex.

#### Feature 5: `analytics.reply.json` Schema
- **Milestone**: M1 | **Interface**: Kafka JSON Schema on `analytics.reply`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F5-01`: Validate reply payload with burndown array containing day-by-day remaining story points.
  2. `T1-F5-02`: Validate velocity metrics response with historical rolling averages.
  3. `T1-F5-03`: Validate matching `correlationId` reflecting the initiating query.
  4. `T1-F5-04`: Validate healthScore number field constrained between 0.0 and 100.0.
  5. `T1-F5-05`: Validate diagnostic list containing issue IDs contributing to delays.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F5-01`: Negative remaining story points in burndown series rejected by schema (`minimum: 0`).
  2. `T2-F5-02`: `healthScore` value `105.0` (> 100) rejected by maximum constraint.
  3. `T2-F5-03`: Burndown series with 0 data points (empty array) validated when sprint just initiated.
  4. `T2-F5-04`: Large array of 1,000 burndown data points validated against array size limits.
  5. `T2-F5-05`: Missing `correlationId` in reply flagged as corrupt message.

#### Feature 6: Contracts Tooling & Generation
- **Milestone**: M1 | **Interface**: Code Generator Scripts (`generate.sh` / `npm run build:proto`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F6-01`: Compilation script generates valid Go `.pb.go` and `_grpc.pb.go` stubs in `gen/go/`.
  2. `T1-F6-02`: Compilation script generates TypeScript interfaces and client/server stubs in `gen/ts/`.
  3. `T1-F6-03`: Compilation script generates C# class files and gRPC services in `gen/csharp/`.
  4. `T1-F6-04`: Tooling executes without error on clean filesystem without pre-existing generated files.
  5. `T1-F6-05`: Generation scripts output consistent checksums across idempotent re-runs.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F6-01`: Execution in read-only target folder emits explicit permission error code.
  2. `T2-F6-02`: Execution with missing protoc compiler fails with informative diagnostic message.
  3. `T2-F6-03`: Malformed proto syntax causes generation script to exit with non-zero exit code.
  4. `T2-F6-04`: Handling file paths containing spaces and non-ASCII path characters on Windows/Linux.
  5. `T2-F6-05`: Partial generation failure cleans up temporary output artifacts without leaving corrupted stubs.

#### Feature 7: Contracts Test Suite & CI
- **Milestone**: M1 | **Interface**: CI Pipeline `.github/workflows/ci.yml` & Schema Unit Tests
- **Tier 1 (Feature Coverage)**:
  1. `T1-F7-01`: Test runner verifies all JSON schemas against official JSON Schema Draft-07 test suites.
  2. `T1-F7-03`: Generation script verification test asserts generated stubs match current proto source.
  3. `T1-F7-04`: Test execution reports line and branch coverage.
  4. `T1-F7-05`: CI workflow steps pass cleanly on standard GitHub Actions runner image.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F7-01`: CI workflow step fails when code coverage falls below 60% threshold.
  2. `T2-F7-02`: Broken schema fixture triggers assertion failure in CI runner.
  3. `T2-F7-03`: Out-of-sync generated stub triggers build step error.
  4. `T2-F7-04`: Handling execution with missing environment variables.
  5. `T2-F7-05`: Large test matrix timeout enforcement (guards against hung test processes).

---

### Module 2: `jira-issues-go` (MS1) (Features 8 - 12)

#### Feature 8: MS1 Go Domain & Models
- **Milestone**: M2 | **Interface**: Go Domain Packages (`internal/domain`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F8-01`: Issue entity creation sets valid initial status `ISSUE_STATUS_TODO`.
  2. `T1-F8-02`: Valid state transition `TODO` -> `IN_PROGRESS` succeeds.
  3. `T1-F8-03`: Valid state transition `IN_PROGRESS` -> `IN_REVIEW` succeeds.
  4. `T1-F8-04`: Valid state transition `IN_REVIEW` -> `DONE` succeeds.
  5. `T1-F8-05`: Project entity validates unique project key constraint (e.g. 2-10 uppercase letters).
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F8-01`: Invalid transition from `TODO` directly to `DONE` without review returns domain error.
  2. `T2-F8-02`: Negative story point value in issue entity validation returns error.
  3. `T2-F8-03`: Empty issue key or project key returns validation error.
  4. `T2-F8-04`: Issue title exceeding 255 characters returns validation error.
  5. `T2-F8-05`: Concurrency conflict during status transition returns domain version conflict.

#### Feature 9: MS1 Go Database Persistence
- **Milestone**: M2 | **Interface**: PostgreSQL Database Repository (`issues_db`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F9-01`: Create issue persists record to `issues` table and populates auto-increment/UUID.
  2. `T1-F9-02`: Query issue by ID returns persisted columns matching saved model.
  3. `T1-F9-03`: List issues filtered by `project_id` and paginated by limit/offset.
  4. `T1-F9-04`: Update issue status updates row and increments `updated_at` timestamp.
  5. `T1-F9-05`: Batch update sprint ID persists new sprint association across multiple issue rows in transaction.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F9-01`: Database connection pool exhaustion recovery: requests queue or fail gracefully under load.
  2. `T2-F9-02`: Transaction rollback on batch update if one issue ID does not exist.
  3. `T2-F9-03`: SQL injection payload in issue title (`'; DROP TABLE issues; --`) safely escaped.
  4. `T2-F9-04`: Duplicate key error on project insertion returns specific domain conflict error.
  5. `T2-F9-05`: Storing and retrieving multi-byte Unicode/Emoji characters in description without corruption.

#### Feature 10: MS1 Go gRPC Server
- **Milestone**: M2 | **Interface**: gRPC Server on `:50051`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F10-01`: Call `CreateIssue` RPC over HTTP/2 returns `CreateIssueResponse` with ID.
  2. `T1-F10-02`: Call `GetIssue` RPC with valid UUID returns full issue record.
  3. `T1-F10-03`: Call `ListIssues` RPC with project filter returns list of matching issues.
  4. `T1-F10-04`: Call `UpdateIssueStatus` RPC updates status and returns updated issue.
  5. `T1-F10-05`: Call `BatchUpdateIssueSprint` RPC updates multiple issues in one network call.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F10-01`: Calling `GetIssue` with non-existent UUID returns gRPC code `NOT_FOUND`.
  2. `T2-F10-02`: Calling `CreateIssue` with missing title returns gRPC code `INVALID_ARGUMENT`.
  3. `T2-F10-03`: Request payload exceeding 4MB gRPC frame limit returns `RESOURCE_EXHAUSTED`.
  4. `T2-F10-04`: Abrupt client disconnect mid-call does not crash gRPC server or leak database connections.
  5. `T2-F10-05`: Rapid successive gRPC calls on the same connection handled concurrently over HTTP/2 multiplexing.

#### Feature 11: MS1 Go Kafka Event Producer
- **Milestone**: M2 | **Interface**: Kafka Producer on `issues.events`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F11-01`: Emits `ISSUE_CREATED` message to `issues.events` immediately after successful DB commit.
  2. `T1-F11-02`: Emits `ISSUE_STATUS_CHANGED` message with old and new status values.
  3. `T1-F11-03`: Event partition key set to `issue.id` to guarantee ordered processing per issue.
  4. `T1-F11-04`: Event payload matches schema defined in `jira-contracts`.
  5. `T1-F11-05`: Producer uses `acks=all` (or 1) ensuring durable broker acknowledgment.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F11-01`: Kafka broker temporarily unavailable does not abort database transaction (buffered/logged).
  2. `T2-F11-02`: Producer retry queue handles transient broker disconnect without duplicate key ordering bugs.
  3. `T2-F11-03`: High throughput burst (1,000 issues) publishes all events without goroutine memory leak.
  4. `T2-F11-04`: Event serialization error logged with error channel notification.
  5. `T2-F11-05`: Graceful shutdown flushes pending Kafka producer buffer within timeout.

#### Feature 12: MS1 Go Test Suite & CI
- **Milestone**: M2 | **Interface**: `go test ./...` and `.github/workflows/ci.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F12-01`: Unit tests run for all domain model rules and transitions.
  2. `T1-F12-02`: Repository unit/mock tests execute without live DB dependencies.
  3. `T1-F12-03`: gRPC handler tests verify request/response serialization.
  4. `T1-F12-04`: `go test -coverprofile=coverage.out` produces valid coverage report.
  5. `T1-F12-05`: CI workflow asserts code coverage $\ge 60\%$.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F12-01`: CI workflow step fails when coverage is $< 60\%$.
  2. `T2-F12-02`: Race detector (`go test -race`) passes with zero race condition warnings.
  3. `T2-F12-03`: Handling mock repository error injection (DB down, timeout).
  4. `T2-F12-04`: Testing with empty database table returns empty slice, not nil pointer crash.
  5. `T2-F12-05`: Handling SIGTERM signal during test execution.

---

### Module 3: `jira-sprints-nestjs` (MS2) (Features 13 - 18)

#### Feature 13: MS2 NestJS Domain & Models
- **Milestone**: M3 | **Interface**: NestJS Sprint Domain Entities & Services
- **Tier 1 (Feature Coverage)**:
  1. `T1-F13-01`: Sprint entity initializes with status `SPRINT_STATUS_PLANNED`.
  2. `T1-F13-02`: Starting sprint transitions status from `PLANNED` to `ACTIVE`.
  3. `T1-F13-03`: Completing sprint transitions status from `ACTIVE` to `COMPLETED`.
  4. `T1-F13-04`: Sprint capacity calculation aggregates story points of attached issues.
  5. `T1-F13-05`: Alert entity tracks alert type, severity, and impacted sprint ID.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F13-01`: Cannot start a sprint if another sprint in the same project is already `ACTIVE`.
  2. `T2-F13-02`: Cannot complete a sprint that is in `PLANNED` status.
  3. `T2-F13-03`: Sprint duration greater than 60 days rejected by domain policy.
  4. `T2-F13-04`: Total story points calculation handling integer overflow gracefully.
  5. `T2-F13-05`: Starting sprint with 0 attached issues emits a warning but succeeds.

#### Feature 14: MS2 NestJS Database Persistence
- **Milestone**: M3 | **Interface**: PostgreSQL Database Repository (`sprints_db`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F14-01`: Persist new sprint to `sprints` table with generated UUID.
  2. `T1-F14-02`: Find sprint by ID returns persisted entity and status.
  3. `T1-F14-03`: List sprints by project ordered by start date.
  4. `T1-F14-04`: Update sprint status persisted with updated timestamp.
  5. `T1-F14-05`: Persist sprint alert record to `sprint_alerts` table.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F14-01`: Database connection retry on startup when DB is initially unavailable.
  2. `T2-F14-02`: Foreign key violation handling when referencing non-existent project.
  3. `T2-F14-03`: Optimistic locking check when two concurrent requests update sprint status.
  4. `T2-F14-04`: SQL special characters in sprint goal/name handled safely.
  5. `T2-F14-05`: Migration scripts run idempotently without dropping existing data.

#### Feature 15: MS2 NestJS gRPC Server
- **Milestone**: M3 | **Interface**: gRPC Server on `:50052`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F15-01`: `SprintService.CreateSprint` returns created sprint response.
  2. `T1-F15-02`: `SprintService.StartSprint` starts sprint and updates status.
  3. `T1-F15-03`: `SprintService.CompleteSprint` completes sprint and calculates velocity.
  4. `T1-F15-04`: `SprintService.GetSprint` retrieves sprint details.
  5. `T1-F15-05`: `AlertService.TriggerSprintAlert` accepts alert and returns ACK response.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F15-01`: Calling `GetSprint` with non-existent ID returns gRPC `NOT_FOUND`.
  2. `T2-F15-02`: Calling `StartSprint` with invalid ID returns gRPC `INVALID_ARGUMENT`.
  3. `T2-F15-03`: Receiving invalid alert type returns gRPC `INVALID_ARGUMENT`.
  4. `T2-F15-04`: gRPC server handles concurrent requests without dropping connections.
  5. `T2-F15-05`: Malformed protobuf packet returns gRPC error without unhandled exception.

#### Feature 16: MS2 NestJS gRPC Client to MS1
- **Milestone**: M3 | **Interface**: gRPC Client communicating with MS1 on `:50051`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F16-01`: Fetches issues for candidate sprint from MS1 `IssueService.ListIssues`.
  2. `T1-F16-02`: Calls `MS1.BatchUpdateIssueSprint` when issues are assigned to sprint.
  3. `T1-F16-03`: Maps MS1 protobuf issue response to NestJS internal domain model.
  4. `T1-F16-04`: gRPC client channel stays connected with keep-alive pings.
  5. `T1-F16-05`: Successfully validates issue status before sprint start.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F16-01`: MS1 (:50051) unreachable returns gRPC `UNAVAILABLE` and triggers circuit breaker / retry.
  2. `T2-F16-02`: gRPC call timeout after configured deadline (e.g. 3000ms) prevents thread blocking.
  3. `T2-F16-03`: Batch update error in MS1 properly surfaced to MS2 caller with domain error.
  4. `T2-F16-04`: Handling empty issue list response from MS1 gracefully.
  5. `T2-F16-05`: MS1 returns invalid field types handled by defensive type guards.

#### Feature 17: MS2 NestJS Kafka R-R Client
- **Milestone**: M3 | **Interface**: Kafka Request-Reply Producer on `analytics.query` & Consumer on `analytics.reply`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F17-01`: Dispatches query to `analytics.query` with unique `kafka_correlationId` header.
  2. `T1-F17-02`: Awaits reply on `analytics.reply` matching the sent `correlationId`.
  3. `T1-F17-03`: Correlates response and resolves pending async Promise.
  4. `T1-F17-04`: Maps Kafka reply payload to NestJS internal analytics DTO.
  5. `T1-F17-05`: Handles multiple concurrent in-flight queries by routing by correlation ID.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F17-01`: 5000ms timeout guard triggers rejection when no reply arrives in time.
  2. `T2-F17-02`: Orphaned reply with unknown correlation ID ignored without throwing unhandled error.
  3. `T2-F17-03`: Corrupted JSON in reply message logged and rejected safely.
  4. `T2-F17-04`: Rapid re-queries reuse single consumer group without partition rebalance storm.
  5. `T2-F17-05`: Kafka broker disconnect during wait triggers timeout failure cleanly.

#### Feature 18: MS2 NestJS Test Suite & CI
- **Milestone**: M3 | **Interface**: `npm test` and `.github/workflows/ci.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F18-01`: Unit tests for Sprint domain rules and lifecycle states.
  2. `T1-F18-02`: Mock tests for gRPC client communication to MS1.
  3. `T1-F18-03`: Mock tests for Kafka Request-Reply client with simulated responses.
  4. `T1-F18-04`: Jest generates coverage report meeting $\ge 60\%$ threshold.
  5. `T1-F18-05`: CI workflow runs on node 20/22 and validates test pass.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F18-01`: CI step fails when Jest coverage drops below 60%.
  2. `T2-F18-02`: Testing simulated Kafka timeout rejects Promise with TimeoutError.
  3. `T2-F18-03`: Testing gRPC server error interceptor converts internal errors to gRPC codes.
  4. `T2-F18-04`: Memory leak check on uncompleted correlation ID listener maps.
  5. `T2-F18-05`: Asynchronous test teardown closes Kafka consumer and DB pool.

---

### Module 4: `jira-analytics-dotnet` (MS3) (Features 19 - 24)

#### Feature 19: MS3 .NET Domain & Models
- **Milestone**: M4 | **Interface**: C# Domain Models (`JiraAi.Analytics.Domain`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F19-01`: Burndown calculation computes ideal burndown line from start to end date.
  2. `T1-F19-02`: Burndown calculation computes actual remaining story points per day.
  3. `T1-F19-03`: Velocity calculation computes rolling average over last 3 sprints.
  4. `T1-F19-04`: Health score calculation outputs value between 0 and 100 based on completion velocity.
  5. `T1-F19-05`: Scope creep detector detects story point increases after sprint start.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F19-01`: Zero total story points at start computes 0% velocity without division-by-zero exception.
  2. `T2-F19-02`: Sprint duration of 0 days handled with default minimum duration guard.
  3. `T2-F19-03`: Negative completed points clamped to zero in burndown.
  4. `T2-F19-04`: More points completed than total points (over-achievement) computes >100% velocity safely.
  5. `T2-F19-05`: Extremely large point count (1,000,000 pts) handled without integer overflow.

#### Feature 20: MS3 .NET MongoDB Persistence
- **Milestone**: M4 | **Interface**: MongoDB Driver Repository (`analytics_db`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F20-01`: Persists sprint snapshot document in `sprint_snapshots` collection.
  2. `T1-F20-02`: Queries sprint snapshot by `sprintId` returning latest recorded metrics.
  3. `T1-F20-03`: Appends daily burndown entry to historical array.
  4. `T1-F20-04`: Queries velocity history documents by team/project ID.
  5. `T1-F20-05`: Validates indexes on `sprintId` and `timestamp`.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F20-01`: MongoDB temporary network loss triggers automatic connection retry.
  2. `T2-F20-02`: Concurrent upsert on same sprintId does not create duplicate documents.
  3. `T2-F20-03`: Querying non-existent sprintId returns null/empty object instead of throwing.
  4. `T2-F20-04`: Corrupted BSON document handling logs serialization error.
  5. `T2-F20-05`: Document size limit boundary (verifies snapshot array stays within 16MB BSON cap).

#### Feature 21: MS3 .NET Kafka Issues Consumer
- **Milestone**: M4 | **Interface**: Kafka Background Service consuming `issues.events`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F21-01`: Consumes `ISSUE_CREATED` and updates sprint total story points.
  2. `T1-F21-02`: Consumes `ISSUE_STATUS_CHANGED` to `DONE` and updates sprint completed points.
  3. `T1-F21-03`: Consumes `ISSUE_UPDATED` adjusting story point estimates.
  4. `T1-F21-04`: Consumes `ISSUE_DELETED` decrementing sprint story point total.
  5. `T1-F21-05`: Commits Kafka consumer offset after successful snapshot persistence.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F21-01`: Duplicate event (same eventId) processed idempotently without double-counting points.
  2. `T2-F21-02`: Out-of-order event timestamps discarded or merged correctly based on timestamp.
  3. `T2-F21-03`: Malformed event payload placed on dead-letter queue / logged without crashing worker.
  4. `T2-F21-04`: Event with unassigned `sprint_id` ignored by sprint snapshot logic.
  5. `T2-F21-05`: High volume event storm (10,000 events) processed without consumer thread starvation.

#### Feature 22: MS3 .NET Kafka Query Responder
- **Milestone**: M4 | **Interface**: Kafka Worker consuming `analytics.query` & producing `analytics.reply`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F22-01`: Consumes `analytics.query` message from topic.
  2. `T1-F22-02`: Reads `kafka_correlationId` header from query message.
  3. `T1-F22-03`: Computes requested analytics for target sprint.
  4. `T1-F22-04`: Produces reply message to `analytics.reply` preserving `kafka_correlationId` header.
  5. `T1-F22-05`: Reply payload matches `analytics.reply.json` schema.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F22-01`: Query for sprint with no data returns valid reply with zeroed metrics and status `INITIALIZING`.
  2. `T2-F22-02`: Query with missing `correlationId` handled by generating fallback ID or logging warning.
  3. `T2-F22-03`: Kafka produce failure retried before dropping message.
  4. `T2-F22-04`: Empty query payload does not throw NullReferenceException.
  5. `T2-F22-05`: Unrecognized `queryType` returns reply with error status in diagnostic field.

#### Feature 23: MS3 .NET gRPC Client to MS2
- **Milestone**: M4 | **Interface**: gRPC Client invoking MS2 `AlertService` on `:50052`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F23-01`: Calls `AlertService.TriggerSprintAlert` when scope creep exceeds 20% threshold.
  2. `T1-F23-02`: Calls `AlertService.TriggerSprintAlert` when velocity deficit indicates delayed sprint.
  3. `T1-F23-03`: Passes sprint ID, alert type, and diagnostic message in gRPC call.
  4. `T1-F23-04`: Parses successful response from MS2.
  5. `T1-F23-05`: Records alert dispatch timestamp to prevent duplicate spamming.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F23-01`: MS2 (:50052) unavailable handled gracefully without halting Kafka consumer.
  2. `T2-F23-02`: Alert debounce: multiple events causing scope creep within 60s trigger only 1 alert call.
  3. `T2-F23-03`: gRPC call timeout (e.g. 2000ms) prevents worker thread hanging.
  4. `T2-F23-04`: gRPC status `UNAVAILABLE` logged as warning, not unhandled crash.
  5. `T2-F23-05`: Channel credentials and connection reuse across multiple alert dispatches.

#### Feature 24: MS3 .NET Test Suite & CI
- **Milestone**: M4 | **Interface**: `dotnet test` with Coverlet and `.github/workflows/ci.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F24-01`: Unit tests for Burndown and Velocity calculation algorithms.
  2. `T1-F24-02`: Mock tests for MongoDB repository operations.
  3. `T1-F24-03`: Mock tests for Kafka consumer and query responder loops.
  4. `T1-F24-04`: Coverlet produces coverage report asserting $\ge 60\%$ coverage.
  5. `T1-F24-05`: CI workflow runs `dotnet build` and `dotnet test` successfully.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F24-01`: CI workflow step fails if code coverage drops below 60%.
  2. `T2-F24-02`: Testing simulated DB exception handling in background service.
  3. `T2-F24-03`: Testing CancellationToken propagation during worker shutdown.
  4. `T2-F24-04`: Testing boundary arithmetic in rolling average when sprint count is 1.
  5. `T2-F24-05`: Testing mock gRPC client failure does not throw uncaught exception.

---

### Module 5: `jira-mcp-agent` (Features 25 - 29)

#### Feature 25: MCP Agent Core & SDK
- **Milestone**: M5 | **Interface**: TypeScript/Node.js MCP Core using `@modelcontextprotocol/sdk` (Strictly NO Python)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F25-01`: Initializes MCP Server using official `@modelcontextprotocol/sdk`.
  2. `T1-F25-02`: Exposes server info and capabilities according to MCP protocol specs.
  3. `T1-F25-03`: Registers all available tools and resources.
  4. `T1-F25-04`: Handles standard MCP tool execution requests.
  5. `T1-F25-05`: Confirms zero Python dependencies in package manifests and runtime.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F25-01`: Calling unregistered MCP tool returns standard MCP `MethodNotFound` error.
  2. `T2-F25-02`: MCP protocol version mismatch handled with informative error.
  3. `T2-F25-03`: Malformed JSON-RPC message over transport returns parse error.
  4. `T2-F25-04`: High concurrency tool invocations handled asynchronously without race conditions.
  5. `T2-F25-05`: Tool execution failure returns structured tool error rather than server crash.

#### Feature 26: MCP Agent Gemini 2.0 Integration
- **Milestone**: M5 | **Interface**: Google Gemini 2.0 Flash SDK & Offline Fallback Engine
- **Tier 1 (Feature Coverage)**:
  1. `T1-F26-01`: Calls Gemini 2.0 Flash API with configured API key and model parameters.
  2. `T1-F26-02`: Parses structured JSON output from Gemini model into typed response.
  3. `T1-F26-03`: In offline mode or when `GEMINI_API_KEY` is unset, activates deterministic rule-engine fallback.
  4. `T1-F26-04`: Fallback rule-engine generates valid Gherkin acceptance criteria and story estimates.
  5. `T1-F26-05`: Seamless switching between online API and offline fallback based on network status.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F26-01`: Gemini API returns HTTP 429 Rate Limited: seamlessly fails over to rule-engine fallback.
  2. `T2-F26-02`: Gemini API returns HTTP 503 Service Unavailable: triggers fallback with warning header.
  3. `T2-F26-03`: Gemini returns malformed non-JSON markdown: heuristic extractor sanitizes or falls back.
  4. `T2-F26-04`: Request timeout (e.g. 5000ms) on Gemini call triggers fallback without hanging client.
  5. `T2-F26-05`: Prompt injection strings in epic description sanitized and safely processed.

#### Feature 27: MCP Agent REST Endpoints
- **Milestone**: M5 | **Interface**: HTTP REST on `:3000` (`/agent/decompose-epic`, `/agent/plan-sprint`, `/agent/diagnose-metrics`)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F27-01`: `POST /agent/decompose-epic` decomposes epic into list of user stories with Gherkin scenarios.
  2. `T1-F27-02`: `POST /agent/plan-sprint` allocates candidate issues according to team capacity.
  3. `T1-F27-03`: `POST /agent/diagnose-metrics` analyzes burndown data and returns root cause diagnostics.
  4. `T1-F27-04`: Responses return HTTP 200 with `Content-Type: application/json`.
  5. `T1-F27-05`: Response structure strictly adheres to contract defined in `PROJECT.md`.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F27-01`: Empty request body returns HTTP 400 Bad Request.
  2. `T2-F27-02`: Missing mandatory field (e.g. `epicTitle`) returns HTTP 422 Unprocessable Entity.
  3. `T2-F27-03`: Request payload exceeding 1MB returns HTTP 413 Payload Too Large.
  4. `T2-F27-04`: HTTP POST to non-existent route `/agent/unknown` returns HTTP 404.
  5. `T2-F27-05`: Unicode & Emoji in epic description handled correctly in response JSON.

#### Feature 28: MCP Agent Registered Tools
- **Milestone**: M5 | **Interface**: MCP Registered Tool Functions
- **Tier 1 (Feature Coverage)**:
  1. `T1-F28-01`: `estimateStoryPoints` tool calculates Fibonacci point value based on complexity.
  2. `T1-F28-02`: `generateAcceptanceCriteria` tool formats criteria into valid Given/When/Then Gherkin syntax.
  3. `T1-F28-03`: `balanceSprintCapacity` tool optimizes issue selection against team story point budget.
  4. `T1-F28-04`: Tools validate parameter types before executing logic.
  5. `T1-F28-05`: Tools output clean structured JSON objects.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F28-01`: Estimation tool with zero description length assigns default minimum points (1 pt).
  2. `T2-F28-02`: Capacity balancing tool with 0 capacity returns empty issue selection and 0% utilization.
  3. `T2-F28-03`: Capacity balancing with issue points exceeding total capacity suggests backlog deferral.
  4. `T2-F28-04`: Tool parameter containing invalid types returns descriptive error.
  5. `T2-F28-05`: Concurrency safety: multiple simultaneous tool executions maintain isolated execution contexts.

#### Feature 29: MCP Agent Test Suite & CI
- **Milestone**: M5 | **Interface**: `npm test` and `.github/workflows/ci.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F29-01`: Unit tests for all REST route controllers.
  2. `T1-F29-02`: Unit tests for MCP tool definitions and execution handlers.
  3. `T1-F29-03`: Unit tests for offline rule-engine fallback behavior.
  4. `T1-F29-04`: Jest coverage report asserts $\ge 60\%$ code coverage.
  5. `T1-F29-05`: CI workflow runs on Node 20/22 and passes all tests.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F29-01`: CI workflow step fails if Jest coverage is $< 60\%$.
  2. `T2-F29-02`: Mocking external API timeout verifies fallback activation.
  3. `T2-F29-03`: Handling mock Gemini API 500 error verifies error transformation.
  4. `T2-F29-04`: Asserting zero python processes or python package dependencies in repository.
  5. `T2-F29-05`: Validating graceful HTTP server shutdown on SIGINT.

---

### Module 6: `jira-bff` (Features 30 - 34)

#### Feature 30: BFF NestJS GraphQL Gateway
- **Milestone**: M6 | **Interface**: GraphQL Endpoint on `http://localhost:4000/graphql`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F30-01`: GraphQL Introspection query returns complete schema with all Queries and Mutations.
  2. `T1-F30-02`: `Query.issue(id)` returns single Issue with typed fields.
  3. `T1-F30-03`: `Query.issues(projectId, sprintId)` returns list of Issues.
  4. `T1-F30-04`: `Query.sprint(id)` returns Sprint entity.
  5. `T1-F30-05`: `Mutation.createIssue` creates issue and returns created object.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F30-01`: Syntactically invalid GraphQL query returns HTTP 400 with GraphQL syntax error.
  2. `T2-F30-02`: Non-existent field requested in query returns GraphQL validation error.
  3. `T2-F30-03`: Deeply nested recursive query prevented by query depth limit protection.
  4. `T2-F30-04`: Query execution error returns partial data and `errors` array conforming to GraphQL spec.
  5. `T2-F30-05`: Unicode & special characters in GraphQL variables handled safely.

#### Feature 31: BFF NestJS gRPC Clients
- **Milestone**: M6 | **Interface**: gRPC Clients connecting to MS1 (:50051) and MS2 (:50052)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F31-01`: Issue queries/mutations routed to MS1 `IssueService` via gRPC.
  2. `T1-F31-02`: Sprint queries/mutations routed to MS2 `SprintService` via gRPC.
  3. `T1-F31-03`: gRPC responses mapped cleanly to GraphQL resolver return types.
  4. `T1-F31-04`: gRPC channels maintain persistent connection pools.
  5. `T1-F31-05`: Batch operations in GraphQL map to batch gRPC calls.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F31-01`: MS1 (:50051) unavailable converts gRPC `UNAVAILABLE` to GraphQL error with code `SERVICE_UNAVAILABLE`.
  2. `T2-F31-02`: MS2 (:50052) timeout returns user-friendly GraphQL error without hanging gateway.
  3. `T2-F31-03`: gRPC `NOT_FOUND` mapped to GraphQL `null` or `NOT_FOUND` error code.
  4. `T2-F31-04`: Handling concurrent queries resolving data from both MS1 and MS2 via `Promise.all`.
  5. `T2-F31-05`: gRPC metadata propagation (correlation ID, tracing headers).

#### Feature 32: BFF NestJS Kafka R-R Client
- **Milestone**: M6 | **Interface**: Kafka Request-Reply client to MS3 on `analytics.query` & `analytics.reply`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F32-01`: `Query.sprintAnalytics(sprintId)` dispatches Kafka query to MS3.
  2. `T1-F32-02`: Awaits reply matching `kafka_correlationId` header within timeout.
  3. `T1-F32-03`: Resolves GraphQL `SprintAnalytics` type with burndown, velocity, and healthScore.
  4. `T1-F32-04`: Correctly handles empty analytics reply for newly created sprints.
  5. `T1-F32-05`: Resolves nested GraphQL fields on analytics type efficiently.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F32-01`: Kafka Request-Reply timeout (5000ms) returns GraphQL error with code `GATEWAY_TIMEOUT`.
  2. `T2-F32-02`: Corrupted Kafka reply payload results in graceful error response.
  3. `T2-F32-03`: Rapid concurrent requests generate unique correlation IDs without cross-talk.
  4. `T2-F32-04`: Query for invalid sprint ID format rejected before sending Kafka message.
  5. `T2-F32-05`: Kafka broker disconnection handled with retry and graceful error.

#### Feature 33: BFF NestJS REST MCP Client
- **Milestone**: M6 | **Interface**: HTTP Client invoking MCP Agent on `:3000`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F33-01`: `Mutation.decomposeEpic` dispatches HTTP POST to `http://localhost:3000/agent/decompose-epic`.
  2. `T1-F33-02`: `Mutation.planSprint` dispatches HTTP POST to `http://localhost:3000/agent/plan-sprint`.
  3. `T1-F33-03`: `Mutation.diagnoseSprint` dispatches HTTP POST to `http://localhost:3000/agent/diagnose-metrics`.
  4. `T1-F33-04`: Maps REST JSON responses to GraphQL types (`EpicDecomposition`, `SprintPlan`, `SprintDiagnosis`).
  5. `T1-F33-05`: Validates input arguments before HTTP dispatch.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F33-01`: MCP Agent (:3000) unreachable returns GraphQL error `AI_SERVICE_UNAVAILABLE`.
  2. `T2-F33-02`: MCP Agent returns HTTP 500 error mapped cleanly to GraphQL error format.
  3. `T2-F33-03`: MCP Agent slow response handled within configured HTTP timeout.
  4. `T2-F33-04`: Large payload in epic decomposition returned without truncation.
  5. `T2-F33-05`: Special characters and markdown in Gherkin text preserved during JSON mapping.

#### Feature 34: BFF NestJS Test Suite & CI
- **Milestone**: M6 | **Interface**: `npm test` and `.github/workflows/ci.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F34-01`: Unit tests for all GraphQL resolver functions.
  2. `T1-F34-02`: Mock tests for gRPC client delegates.
  3. `T1-F34-03`: Mock tests for Kafka Request-Reply resolver.
  4. `T1-F34-04`: Mock tests for MCP REST client wrapper.
  5. `T1-F34-05`: Jest coverage asserts $\ge 60\%$ code coverage.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F34-01`: CI workflow step fails if Jest coverage is $< 60\%$.
  2. `T2-F34-02`: Mocking downstream service failure returns standard GraphQL error structure.
  3. `T2-F34-03`: Verifying query complexity and depth limit enforcement in tests.
  4. `T2-F34-04`: Testing Apollo error formatting filter.
  5. `T2-F34-05`: Testing application bootstrap and clean shutdown hooks.

---

### Module 7: `jira-mobile` (Features 35 - 41)

#### Feature 35: Mobile React Native App Setup
- **Milestone**: M7 | **Interface**: React Native Expo App Bootstrap & Navigation
- **Tier 1 (Feature Coverage)**:
  1. `T1-F35-01`: App bootstraps main navigation container without runtime errors.
  2. `T1-F35-02`: Bottom tab navigation renders tabs: Backlog, Scrum Board, Analytics, AI Assistant.
  3. `T1-F35-03`: Switching tabs navigates to the respective screen component.
  4. `T1-F35-04`: Global theme provider applies styling and dark/light modes.
  5. `T1-F35-05`: App renders responsive layouts across varying mobile screen dimensions.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F35-01`: App launches cleanly in offline mode (no network connectivity).
  2. `T2-F35-02`: Handling deep links navigating directly to specific issue ID.
  3. `T2-F35-03`: Orientation change (Portrait to Landscape) adapts layout without crash.
  4. `T2-F35-04`: Low memory warning handler cleans unmounted screen caches.
  5. `T2-F35-05`: High text accessibility scaling (200% font scale) renders without text truncation.

#### Feature 36: Mobile Apollo Client Integration
- **Milestone**: M7 | **Interface**: Apollo Client communicating with BFF `/graphql`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F36-01`: Configures Apollo Client `HttpLink` pointing to BFF GraphQL URL.
  2. `T1-F36-02`: `InMemoryCache` properly normalizes cache keys by `__typename` and `id`.
  3. `T1-F36-03`: GraphQL queries populate UI components via `useQuery` hooks.
  4. `T1-F36-04`: GraphQL mutations execute and update local cache via `useMutation`.
  5. `T1-F36-05`: Error link catches network and GraphQL errors and populates global error state.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F36-01`: Network timeout displays user-friendly retry banner.
  2. `T2-F36-02`: GraphQL server error returns cached data when available (`cache-first` policy).
  3. `T2-F36-03`: Cache mutation optimistic response updates UI instantly before server confirmation.
  4. `T2-F36-04`: Rollback of optimistic response when mutation fails on server.
  5. `T2-F36-05`: Apollo cache garbage collection cleans evicted items without memory leaks.

#### Feature 37: Mobile Backlog Screen
- **Milestone**: M7 | **Interface**: Backlog UI & AI Epic Breakdown Trigger
- **Tier 1 (Feature Coverage)**:
  1. `T1-F37-01`: Renders list of backlog issues with key, title, priority, and points.
  2. `T1-F37-02`: Filter issues by search query or issue type.
  3. `T1-F37-03`: Tap on Epic opens "AI Epic Breakdown" modal.
  4. `T1-F37-04`: Submitting AI breakdown calls `decomposeEpic` mutation and renders generated stories.
  5. `T1-F37-05`: "Accept Stories" button creates generated stories in backlog.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F37-01`: Empty backlog shows friendly empty-state illustration and create button.
  2. `T2-F37-02`: Pull-to-refresh triggers query refetch and hides spinner on completion.
  3. `T2-F37-03`: Rapid multiple taps on "Breakdown" button debounced to prevent duplicate mutations.
  4. `T2-F37-04`: Long epic title and description render with ellipsis / expandable view.
  5. `T2-F37-05`: AI breakdown failure shows retry prompt without losing epic context.

#### Feature 38: Mobile Scrum Board Screen
- **Milestone**: M7 | **Interface**: 4-Column Scrum Board (TODO, IN_PROGRESS, IN_REVIEW, DONE)
- **Tier 1 (Feature Coverage)**:
  1. `T1-F38-01`: Displays active sprint title and 4 columns: TODO, IN_PROGRESS, IN_REVIEW, DONE.
  2. `T1-F38-02`: Renders issue cards with status, assignee avatar, and story points in appropriate columns.
  3. `T1-F38-03`: Drag-and-drop or status selector moves card to new column.
  4. `T1-F38-04`: Card transition dispatches `updateIssueStatus` mutation to BFF.
  5. `T1-F38-05`: Total story points per column computed and displayed in header.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F38-01`: No active sprint shows prompt to start or select a planned sprint.
  2. `T2-F38-02`: Moving card to invalid status column displays error toast and snaps card back.
  3. `T2-F38-03`: Column with 100+ cards renders with virtualized list (`FlatList`) for smooth 60fps scrolling.
  4. `T2-F38-04`: Network disconnect during card drop rolls back card position and displays warning.
  5. `T2-F38-05`: Rapid drag events handled without state corruption.

#### Feature 39: Mobile Burndown & Analytics UI
- **Milestone**: M7 | **Interface**: Burndown Chart, Velocity Metrics, & Diagnostic Alerts
- **Tier 1 (Feature Coverage)**:
  1. `T1-F39-01`: Renders Burndown chart showing Ideal Burndown line and Actual Remaining line.
  2. `T1-F39-02`: Displays Sprint Health Score badge (Green: >80, Yellow: 50-80, Red: <50).
  3. `T1-F39-03`: Displays rolling team velocity bar chart over historical sprints.
  4. `T1-F39-04`: Displays active sprint risk alerts (e.g. Scope Creep, Bottleneck Detected).
  5. `T1-F39-05`: Tap on alert opens diagnostic breakdown with recommended remediations.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F39-01`: Sprint on Day 1 renders single starting point on actual burndown line.
  2. `T2-F39-02`: Missing burndown data shows empty chart state rather than rendering error.
  3. `T2-F39-03`: Pinch-to-zoom and pan on burndown chart operates smoothly.
  4. `T2-F39-04`: Negative trend in burndown (scope addition) visualizes upward slope accurately.
  5. `T2-F39-05`: High alert volume (10+ alerts) renders in scrollable list with severity filter.

#### Feature 40: Mobile AI Assistant Modal
- **Milestone**: M7 | **Interface**: AI Scrum Master Chat Modal
- **Tier 1 (Feature Coverage)**:
  1. `T1-F40-01`: Floating AI button opens Scrum Master Assistant modal.
  2. `T1-F40-02`: Displays contextual suggestions (e.g. "Plan Next Sprint", "Diagnose Velocity").
  3. `T1-F40-03`: User types question and sends chat message.
  4. `T1-F40-04`: Assistant streams or renders AI response formatted in Markdown with Gherkin blocks.
  5. `T1-F40-05`: "Apply Suggestion" button executes recommended action directly.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F40-01`: Empty prompt submission disabled.
  2. `T2-F40-02`: Offline network status shows badge "Offline AI (Rule Engine Mode)".
  3. `T2-F40-03`: Very long conversation history preserved in scroll view without UI lag.
  4. `T2-F40-04`: Special markdown characters and code snippets rendered cleanly with syntax styling.
  5. `T2-F40-05`: Dismissing modal retains ongoing question state.

#### Feature 41: Mobile Test Suite & CI
- **Milestone**: M7 | **Interface**: `npm test` with Jest/React Native Testing Library & CI
- **Tier 1 (Feature Coverage)**:
  1. `T1-F41-01`: Component tests for Backlog and Scrum Board screens.
  2. `T1-F41-02`: Component tests for Burndown chart rendering.
  3. `T1-F41-03`: Hook tests for Apollo Client queries and mutations with `MockedProvider`.
  4. `T1-F41-04`: Jest coverage asserts $\ge 60\%$ code coverage.
  5. `T1-F41-05`: CI workflow runs lint, type-check, and tests successfully.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F41-01`: CI workflow step fails if Jest coverage is $< 60\%$.
  2. `T2-F41-02`: Mocking GraphQL network error tests UI error boundary rendering.
  3. `T2-F41-03`: Testing snapshot rendering across tablet and phone viewport configs.
  4. `T2-F41-04`: Testing unmounting components during async query resolution does not trigger memory leak warnings.
  5. `T2-F41-05`: Accessibility tests verify testID and accessibilityLabel attributes.

---

### Module 8 & 9: Infrastructure, Orchestration, CI/CD, and E2E (Features 42 - 45)

#### Feature 42: Root Docker Compose
- **Milestone**: M8 | **Interface**: `docker-compose.yml`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F42-01`: Defines containers for Postgres (`issues_db`), Postgres (`sprints_db`), Mongo (`analytics_db`).
  2. `T1-F42-02`: Defines containers for Zookeeper and Apache Kafka broker with configured topics.
  3. `T1-F42-03`: Defines containers for MS1 (Go), MS2 (NestJS), MS3 (.NET), MCP Agent, and BFF.
  4. `T1-F42-04`: Configures network bridge allowing inter-container resolution by service name.
  5. `T1-F42-05`: Configures container health checks (`pg_isready`, mongosh, curl).
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F42-01`: Dependent services wait for DB and Kafka health checks before starting (`depends_on: condition: service_healthy`).
  2. `T2-F42-02`: Persistent volume mapping ensures database data survives container restart.
  3. `T2-F42-03`: Port conflict resilience (configurable host port bindings via environment variables).
  4. `T2-F42-04`: Environment variable fallback defaults allow boot with zero `.env` file present.
  5. `T2-F42-05`: `docker compose down -v` cleanly cleans up all networks and volumes.

#### Feature 43: Native Kubernetes Manifests
- **Milestone**: M8 | **Interface**: `k8s/*.yaml` Manifests
- **Tier 1 (Feature Coverage)**:
  1. `T1-F43-01`: Defines Kubernetes Deployments with replicas and image tags for each service.
  2. `T1-F43-02`: Defines ClusterIP Services for internal gRPC (:50051, :50052) and REST (:3000).
  3. `T1-F43-03`: Defines NodePort / Ingress Service for BFF GraphQL (:4000).
  4. `T1-F43-04`: Defines ConfigMaps and Secrets for database credentials and Kafka broker URLs.
  5. `T1-F43-05`: Defines liveness and readiness probes (`/health`, exec probes) on all pods.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F43-01`: Resource requests and limits (CPU/Memory) specified on every pod to prevent node OOM.
  2. `T2-F43-02`: RollingUpdate deployment strategy ensures zero downtime during pod redeployment.
  3. `T2-F43-03`: Pod restart policy `Always` handles transient crashes.
  4. `T2-F43-04`: Validation with `kubectl apply --dry-run=client` validates syntax and API schema.
  5. `T2-F43-05`: SecurityContext non-root user execution enforcement on containers.

#### Feature 44: CI/CD Workflows Verification
- **Milestone**: M9 | **Interface**: Multi-Repo GitHub Actions Workflows
- **Tier 1 (Feature Coverage)**:
  1. `T1-F44-01`: CI workflow exists in `jira-contracts` enforcing $\ge 60\%$ coverage.
  2. `T1-F44-02`: CI workflow exists in `jira-issues-go` enforcing $\ge 60\%$ coverage.
  3. `T1-F44-03`: CI workflow exists in `jira-sprints-nestjs` enforcing $\ge 60\%$ coverage.
  4. `T1-F44-04`: CI workflow exists in `jira-analytics-dotnet` enforcing $\ge 60\%$ coverage.
  5. `T1-F44-05`: CI workflows exist in `jira-mcp-agent`, `jira-bff`, and `jira-mobile` enforcing $\ge 60\%$ coverage.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F44-01`: CI pipeline fails step and blocks PR merge if coverage drops to 59.9%.
  2. `T2-F44-02`: CI execution with parallel matrix builds handles varying OS runners without syntax errors.
  3. `T2-F44-03`: Cache keys for dependencies (npm, go mod, nuget) invalidate correctly on lockfile change.
  4. `T2-F44-04`: Security secret masking prevents leaking API tokens in CI log output.
  5. `T2-F44-05`: Concurrency cancel-in-progress terminates obsolete runs on rapid commits.

#### Feature 45: End-to-End Test Suite
- **Milestone**: M9 | **Interface**: Opaque-box E2E Suite in `tests/e2e/`
- **Tier 1 (Feature Coverage)**:
  1. `T1-F45-01`: Executes complete multi-service user story from AI epic decomposition to sprint completion.
  2. `T1-F45-02`: Verifies gRPC inter-service communication between NestJS and Go.
  3. `T1-F45-03`: Verifies Kafka Request-Reply flow between NestJS and .NET with correlation matching.
  4. `T1-F45-04`: Verifies MS3 gRPC alert dispatch to MS2 on detected scope creep.
  5. `T1-F45-05`: Generates unified test pass/fail report with latency and assertion metrics.
- **Tier 2 (Boundary & Corner Cases)**:
  1. `T2-F45-01`: Executes with mock backend services in isolated standalone mode (zero external daemon required).
  2. `T2-F45-02`: Executes against live Docker Compose cluster when `E2E_TARGET=live` is configured.
  3. `T2-F45-03`: Detects and reports latency spikes (>2000ms) across cross-service calls.
  4. `T2-F45-04`: Chaos injection: simulated broker lag does not cause suite hang (strict test timeouts).
  5. `T2-F45-05`: Clean teardown guarantees zero orphaned child processes or open ports.

---

## 5. Tier 3: Cross-Feature Combinations & Pairwise Testing

To rigorously verify interoperability without brute-force combinatorial explosion, the test suite executes an orthogonal Pairwise Matrix covering all multi-service boundaries:

### 5.1 Cross-Service Protocol & Transformation Matrix

| Pair ID | Origin Service & Protocol | Target Service & Protocol | Payload / Transformation Tested | Validation Contract |
|:---|:---|:---|:---|:---|
| `PAIR-01` | BFF (GraphQL Mutation) | MS1 (gRPC `:50051`) | `createIssue` -> `CreateIssueRequest` | Proto ID returned and mapped to GraphQL `Issue` |
| `PAIR-02` | BFF (GraphQL Query) | MS1 (gRPC `:50051`) | `Query.issues` -> `ListIssuesRequest` | Proto repeated stream converted to GraphQL array |
| `PAIR-03` | BFF (GraphQL Mutation) | MS2 (gRPC `:50052`) | `createSprint` -> `CreateSprintRequest` | Proto Sprint entity converted to GraphQL `Sprint` |
| `PAIR-04` | BFF (GraphQL Mutation) | MS2 (gRPC `:50052`) | `startSprint` -> `StartSprintRequest` | State transition validated; status `ACTIVE` returned |
| `PAIR-05` | BFF (GraphQL Query) | MS3 (Kafka R-R) | `Query.sprintAnalytics` -> `analytics.query` | Correlation ID match, Kafka reply parsed into GraphQL DTO |
| `PAIR-06` | BFF (GraphQL Mutation) | MCP Agent (REST `:3000`)| `decomposeEpic` -> `POST /agent/decompose-epic` | Gherkin scenarios returned in JSON; mapped to GraphQL |
| `PAIR-07` | BFF (GraphQL Mutation) | MCP Agent (REST `:3000`)| `planSprint` -> `POST /agent/plan-sprint` | Capacity allocation returned in JSON; mapped to GraphQL |
| `PAIR-08` | BFF (GraphQL Mutation) | MCP Agent (REST `:3000`)| `diagnoseSprint` -> `POST /agent/diagnose-metrics`| Diagnostics & recommendations mapped to GraphQL |
| `PAIR-09` | MS2 (NestJS gRPC Client) | MS1 (Go gRPC `:50051`) | `SprintService.StartSprint` -> `MS1.ListIssues` | MS2 validates all candidate issues exist in MS1 |
| `PAIR-10` | MS2 (NestJS gRPC Client) | MS1 (Go gRPC `:50051`) | `BatchUpdateIssueSprint` | MS2 associates 10 issues with new sprint in MS1 |
| `PAIR-11` | MS1 (Go Domain Event) | Kafka Broker | `IssueService.CreateIssue` -> `issues.events` | Envelope with `ISSUE_CREATED` published to topic |
| `PAIR-12` | MS1 (Go Domain Event) | Kafka Broker | `UpdateIssueStatus(DONE)` -> `issues.events` | Envelope with `ISSUE_STATUS_CHANGED` published |
| `PAIR-13` | Kafka Broker | MS3 (.NET Consumer) | `issues.events` -> Burndown Snapshot Update | Event consumed; completed points incremented |
| `PAIR-14` | MS2 (NestJS Kafka Client)| MS3 (.NET Kafka Worker) | `analytics.query` -> `analytics.reply` | Request-reply completed within 5000ms guard |
| `PAIR-15` | MS3 (.NET gRPC Client) | MS2 (NestJS gRPC `:50052`) | Scope Creep -> `AlertService.TriggerSprintAlert` | gRPC alert received, stored, and acknowledged |
| `PAIR-16` | MS3 (.NET gRPC Client) | MS2 (NestJS gRPC `:50052`) | Velocity Deficit -> `TriggerSprintAlert` | High severity alert triggered and acknowledged |
| `PAIR-17` | Mobile (Apollo Client) | BFF (GraphQL Gateway) | Backlog Load -> `Query.issues` | Apollo cache populated; Backlog list rendered |
| `PAIR-18` | Mobile (Apollo Client) | BFF (GraphQL Gateway) | Drag Card -> `Mutation.updateIssueStatus` | Optimistic UI update, confirmed by BFF |
| `PAIR-19` | Mobile (Apollo Client) | BFF (GraphQL Gateway) | Analytics View -> `Query.sprintAnalytics` | Chart data rendered from multi-service Kafka flow |
| `PAIR-20` | Mobile (Apollo Client) | BFF (GraphQL Gateway) | AI Assistant Chat -> `Mutation.decomposeEpic` | Markdown response formatted with Gherkin scenarios |

---

## 6. Tier 4: Real-World Workload Scenarios

The E2E suite implements 5 comprehensive, realistic operational scenarios:

### 6.1 Scenario 1: Greenfield Inception & AI Sprint Inception
- **Story**: An Agile Product Owner creates an Epic on mobile, uses Gemini MCP to decompose it into Gherkin user stories, saves them into MS1, creates a 2-week Sprint in MS2, uses MCP capacity balancing to allocate stories to the sprint, and starts the sprint.
- **Interfaces Exercised**:
  1. BFF `Mutation.decomposeEpic` -> MCP Agent `POST /agent/decompose-epic`.
  2. BFF `Mutation.createIssue` (repeated $\times 4$) -> MS1 gRPC `CreateIssue` -> MS1 emits `ISSUE_CREATED` to Kafka.
  3. BFF `Mutation.createSprint` -> MS2 gRPC `CreateSprint`.
  4. BFF `Mutation.planSprint` -> MCP Agent `POST /agent/plan-sprint`.
  5. MS2 invokes MS1 gRPC `BatchUpdateIssueSprint`.
  6. BFF `Mutation.startSprint` -> MS2 gRPC `StartSprint`.
- **Expected Observable Result**: Sprint status is `ACTIVE`, all 4 issues are linked to `sprintId`, total story points equals sum of estimates, and Kafka topic `issues.events` holds 4 creation events.

### 6.2 Scenario 2: Active Sprint Execution & Scrum Board Transition
- **Story**: Team members update task statuses on the mobile Scrum Board during daily standups. Cards move from TODO -> IN_PROGRESS -> IN_REVIEW -> DONE. MS1 produces events, MS3 updates MongoDB burndown snapshot, and mobile queries live burndown chart.
- **Interfaces Exercised**:
  1. BFF `Mutation.updateIssueStatus(ISSUE_STATUS_IN_PROGRESS)` -> MS1 gRPC -> Kafka event `ISSUE_STATUS_CHANGED`.
  2. MS3 consumes event and logs active work in progress.
  3. BFF `Mutation.updateIssueStatus(ISSUE_STATUS_DONE)` -> MS1 gRPC -> Kafka event `ISSUE_STATUS_CHANGED`.
  4. MS3 consumes event, increments `completed_story_points`, recalculates burndown.
  5. BFF `Query.sprintAnalytics` -> Kafka Request-Reply `analytics.query` -> MS3 -> `analytics.reply`.
- **Expected Observable Result**: Burndown remaining story points decrease by the completed issue's points, velocity health score remains $>80\%$, and GraphQL query reflects updated burndown chart.

### 6.3 Scenario 3: Sprint Mid-Flight Scope Creep & Automated Bottleneck Alerting
- **Story**: Stakeholders inject two high-priority urgent bugs into an active sprint. Total story points increase by 35%. MS3 detects scope creep $>20\%$ and dispatches an automated gRPC alert to MS2 `AlertService`. Mobile displays a Warning banner.
- **Interfaces Exercised**:
  1. BFF `Mutation.createIssue` with `sprintId` set -> MS1 gRPC -> Kafka event `ISSUE_CREATED`.
  2. MS3 consumes event, detects total points increased from 20 to 27 pts ($+35\%$).
  3. MS3 gRPC Client invokes MS2 `:50052` `AlertService.TriggerSprintAlert` with `ALERT_TYPE_SCOPE_CREEP` and `ALERT_SEVERITY_WARNING`.
  4. MS2 logs alert in database and marks sprint state as flagged.
  5. BFF `Query.sprint(id)` returns active sprint with `hasActiveAlerts: true` and alert details.
- **Expected Observable Result**: Alert is successfully persisted in MS2, acknowledged to MS3 via gRPC status OK, and visible in BFF GraphQL query response.

### 6.4 Scenario 4: AI Scrum Master Sprint Retrospective & Metric Diagnosis
- **Story**: At sprint completion, the Scrum Master triggers an automated AI metric diagnosis. BFF fetches burndown and velocity from MS3 via Kafka R-R, passes the metrics to MCP Agent `/agent/diagnose-metrics`, which identifies bottlenecks and returns root-cause analysis and actionable recommendations.
- **Interfaces Exercised**:
  1. BFF `Query.sprintAnalytics` -> Kafka Request-Reply to MS3 -> retrieves burndown data.
  2. BFF `Mutation.diagnoseSprint` -> MCP Agent `POST /agent/diagnose-metrics`.
  3. MCP Agent evaluates burndown slope against ideal line, checks blocked issue count, and outputs structured diagnosis.
  4. BFF returns GraphQL `SprintDiagnosis` with `healthStatus`, `diagnosis`, `rootCauses`, and `actionableRecommendations`.
  5. BFF `Mutation.completeSprint` -> MS2 gRPC `CompleteSprint`.
- **Expected Observable Result**: Sprint transitions to `COMPLETED`, diagnostic recommendations contain specific actionable guidance, and burndown snapshot is archived in MS3.

### 6.5 Scenario 5: Catastrophic Resilience & Partial Degradation Workload
- **Story**: Stress test simulating network degradation: Kafka Request-Reply experiences broker lag (5000ms timeout guard), and Gemini API experiences rate-limiting (HTTP 429). System must maintain data integrity, invoke the offline heuristic fallback engine, and return clean error codes rather than crashing.
- **Interfaces Exercised**:
  1. BFF Kafka Request-Reply dispatched with simulated delay exceeding 5000ms -> BFF returns `GATEWAY_TIMEOUT` without blocking server.
  2. MCP Agent epic decomposition called with invalid or rate-limited Gemini token -> MCP Agent activates offline rule-engine fallback, returning valid Gherkin stories with header `x-ai-engine: offline-heuristic`.
  3. gRPC call to MS1 with invalid arguments returns clean gRPC `INVALID_ARGUMENT` mapped to GraphQL client error.
  4. All services recover immediately once transient fault clears.
- **Expected Observable Result**: Zero unhandled node process crashes; offline fallback generates valid Gherkin; timeouts fail fast cleanly.

---

## 7. Test Architecture & Directory Layout

The opaque-box E2E test harness resides in `tests/e2e/`:

```
C:\jira-ai\tests\e2e\
├── harness/
│   ├── mock-cluster.ts        # Embedded polyglot mock servers (gRPC, Kafka R-R, REST, GraphQL)
│   ├── e2e-client.ts          # Unified client executing GraphQL, REST, and gRPC calls
│   └── test-fixtures.ts       # Canonical payloads conforming to jira-contracts
├── suites/
│   ├── tier1-features.test.ts # Feature coverage tests for all core capabilities
│   ├── tier2-boundaries.test.ts# Boundary value and adversarial cases
│   ├── tier3-pairwise.test.ts  # Cross-service protocol pairwise combinations
│   └── tier4-scenarios.test.ts # The 5 complete end-to-end workload scenarios
├── run-e2e.ts                 # Master test runner and reporter
├── package.json               # Runner scripts and dependencies
├── tsconfig.json              # TypeScript compilation configuration
└── README.md                  # Execution instructions
```

### 7.1 Test Invocation Commands

```bash
# Install dependencies in test harness
cd C:\jira-ai\tests\e2e && npm install

# Execute entire opaque-box E2E test suite (standalone mock mode)
cd C:\jira-ai\tests\e2e && npm test

# Execute against live Docker Compose cluster
cd C:\jira-ai\tests\e2e && set E2E_TARGET=live && npm test

# Execute individual test tiers
npm run test:tier1
npm run test:tier2
npm run test:tier3
npm run test:tier4
```

---

## 8. Quality Gates & Continuous Verification

1. **Local Pre-Commit Gate**: Developers can run `npm test` inside `tests/e2e` in under 15 seconds without running Docker.
2. **CI Regression Gate**: Every pull request across any of the 7 repositories triggers the contract tests and relevant unit tests asserting $\ge 60\%$ coverage.
3. **M9 Final E2E Gate**: Milestone 9 executes the full E2E test suite against the orchestrated Docker Compose / Kubernetes environment, verifying all 45 features and 5 real-world scenarios.
