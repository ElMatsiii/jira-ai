# Jira AI Opaque-Box E2E Test Suite

This test suite performs comprehensive opaque-box (black-box) end-to-end integration testing for the Jira AI distributed platform.

## Test Architecture

- **Opaque-Box Principles**: Tests interact exclusively through observable external service boundaries:
  - **BFF GraphQL Gateway**: `/graphql` (HTTP POST)
  - **MCP Agent REST API**: `/agent/decompose-epic`, `/agent/plan-sprint`, `/agent/diagnose-metrics` (HTTP POST)
  - **Kafka Streaming**: `issues.events`, `analytics.query`, `analytics.reply`
  - **gRPC Services**: `IssueService` (:50051), `SprintService` / `AlertService` (:50052)
- **Zero-Dependency Execution**: Powered by Node.js 24 (`node --experimental-strip-types`) with an embedded mock cluster simulating the 6 distributed backend services for deterministic, lightning-fast testing during development.
- **Live Cluster Mode**: Supports testing directly against running Docker Compose or Kubernetes clusters by setting `E2E_TARGET=live`.

## Directory Structure

```
tests/e2e/
├── harness/
│   ├── mock-cluster.ts        # Embedded polyglot mock servers & chaos controllers
│   ├── e2e-client.ts          # Unified client for GraphQL, REST, and wait utilities
│   └── test-fixtures.ts       # Canonical data models conforming to jira-contracts
├── suites/
│   ├── tier1-features.test.ts # Feature coverage tests for core capabilities
│   ├── tier2-boundaries.test.ts# Boundary value analysis & adversarial edge cases
│   ├── tier3-pairwise.test.ts  # Combinatorial pairwise cross-service interactions
│   └── tier4-scenarios.test.ts # 5 full real-world user workload scenarios
├── run-e2e.ts                 # Master test orchestrator and summary reporter
├── package.json               # NPM scripts and runner definitions
├── tsconfig.json              # TypeScript compilation configuration
└── README.md                  # This file
```

## Running the Tests

```bash
# Run all E2E test suites (Tier 1 to Tier 4)
cd tests/e2e
npm test

# Run specific test tiers
npm run test:tier1   # Core Feature Coverage
npm run test:tier2   # Boundary & Adversarial Cases
npm run test:tier3   # Pairwise Combinations
npm run test:tier4   # Real-World Workload Scenarios

# Run against live containers (Docker Compose / K8s)
set E2E_TARGET=live
set BFF_URL=http://localhost:4000
set MCP_URL=http://localhost:3000
npm test
```
