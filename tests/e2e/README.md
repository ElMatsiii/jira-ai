# Jira AI Opaque-Box E2E Test Suite

This test suite performs comprehensive opaque-box (black-box) end-to-end integration testing for the Jira AI distributed platform.

## Test Architecture

- **Opaque-Box Principles**: Tests interact exclusively through observable external service boundaries:
  - The simulated **BFF GraphQL Gateway**: `/graphql` (HTTP POST)
  - The simulated **MCP Agent REST API**: `/agent/decompose-epic`, `/agent/plan-sprint`, `/agent/diagnose-metrics` (HTTP POST)
  - Simulated Kafka and gRPC interactions in the mock cluster
- **Zero-Dependency Execution**: Powered by Node.js 22.6+ (`node --experimental-strip-types`) with an embedded mock cluster simulating the distributed backend services for deterministic, fast contract-flow tests.
- **Live Smoke Checks**: `npm run smoke:live` checks the real frontend, BFF GraphQL endpoint, and MCP health endpoint after starting Docker Compose. This is a connectivity check, not a full live business-flow suite.

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

# Run smoke checks against live containers (Docker Compose / K8s)
npm run smoke:live
```

The `npm test` suites always use `MockCluster`; they do not connect to Docker or Kubernetes. Optional `BFF_URL`, `MCP_URL`, and `WEB_URL` variables configure the live smoke-check targets.
