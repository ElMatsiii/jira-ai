import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCluster } from '../harness/mock-cluster.ts';
import { E2EClient } from '../harness/e2e-client.ts';
import { IssueStatus, IssuePriority, IssueType } from '../harness/test-fixtures.ts';

describe('Tier 2: Boundary Values & Adversarial Edge Cases Suite', () => {
  let cluster: MockCluster;
  let client: E2EClient;
  const bffPort = 14002;
  const mcpPort = 13002;

  before(async () => {
    cluster = new MockCluster({ bffPort, mcpPort });
    await cluster.start();
    client = new E2EClient(bffPort, mcpPort);
  });

  after(async () => {
    await cluster.stop();
  });

  beforeEach(() => {
    cluster.resetState();
  });

  // T2-F1/F8: Missing Mandatory Fields
  it('T2-BVA-01: should reject issue creation when title is empty or missing', async () => {
    const res = await client.graphql(`
      mutation {
        createIssue(input: { title: "", storyPoints: 5 }) {
          id
        }
      }
    `);

    assert.ok(res.errors, 'Expected validation error');
    assert.equal(res.errors[0].extensions?.code, 'BAD_USER_INPUT');
    assert.equal(cluster.issuesDb.size, 0);
  });

  // T2-F1/F10: Non-Existent Resources
  it('T2-BVA-02: should return null when querying non-existent issue ID', async () => {
    const res = await client.graphql(`
      query {
        issue(id: "non-existent-uuid-99999") {
          id
          title
        }
      }
    `);

    assert.ok(!res.errors, 'GraphQL query itself should succeed without crashing');
    assert.equal(res.data?.issue, null);
  });

  it('T2-BVA-03: should return NOT_FOUND error when updating non-existent issue status', async () => {
    const res = await client.graphql(`
      mutation {
        updateIssueStatus(id: "invalid-id-404", status: 2) {
          id
        }
      }
    `);

    assert.ok(res.errors, 'Expected error response');
    assert.equal(res.errors[0].extensions?.code, 'NOT_FOUND');
  });

  it('T2-BVA-04: should return NOT_FOUND error when starting non-existent sprint', async () => {
    const res = await client.graphql(`
      mutation {
        startSprint(id: "non-existent-sprint-id") {
          id
        }
      }
    `);

    assert.ok(res.errors);
    assert.equal(res.errors[0].extensions?.code, 'NOT_FOUND');
  });

  // T2-F1/F9: Extreme Character Lengths & Unicode/Emoji Fidelity
  it('T2-BVA-05: should preserve large descriptions with multi-byte UTF-8 and emoji characters', async () => {
    const complexDescription = '🚀 Sprint Inception 🎯 — ' + 'ÁÉÍÓÚñÑ 日本語 🌟 ⚡ '.repeat(200);

    const res = await client.graphql(`
      mutation CreateIssue($input: CreateIssueInput!) {
        createIssue(input: $input) {
          id
          title
          description
        }
      }
    `, {
      input: {
        title: 'Multi-byte Unicode & Stress Test',
        description: complexDescription,
        storyPoints: 8,
      },
    });

    assert.ok(res.data?.createIssue);
    assert.equal(res.data.createIssue.description, complexDescription);
    const saved = cluster.issuesDb.get(res.data.createIssue.id);
    assert.equal(saved?.description, complexDescription);
  });

  // T2-F27: MCP REST API Boundary Validations
  it('T2-BVA-06: should return 422 when decomposing epic without mandatory epicTitle', async () => {
    const res = await client.mcpPost('/agent/decompose-epic', {
      epicDescription: 'Description provided but title omitted',
    });

    assert.equal(res.status, 422);
    assert.ok(res.body.error.includes('epicTitle'));
  });

  it('T2-BVA-07: should return 404 for undefined REST endpoints', async () => {
    const res = await client.mcpPost('/agent/undefined-endpoint-xyz', {});
    assert.equal(res.status, 404);
  });

  it('T2-BVA-08: should return 400 when invalid non-JSON body is posted to GraphQL', async () => {
    const rawRes = await fetch(`${client.bffUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'MALFORMED-BODY-NOT-JSON{{{',
    });

    assert.equal(rawRes.status, 400);
    const json: any = await rawRes.json();
    assert.ok(json.errors);
  });

  // T2-F17/F32: Kafka Request-Reply 5000ms Timeout Guard
  it('T2-BVA-09: should return GATEWAY_TIMEOUT when Kafka Request-Reply fails to reply within 5000ms', async () => {
    cluster.simulateKafkaTimeout = true;

    const res = await client.graphql(`
      query {
        sprintAnalytics(sprintId: "sprint-timeout-test") {
          sprintId
        }
      }
    `);

    assert.ok(res.errors, 'Expected gateway timeout error');
    assert.equal(res.errors[0].extensions?.code, 'GATEWAY_TIMEOUT');
    assert.ok(res.errors[0].message.includes('5000ms'));
  });

  // T2-F45: Catastrophic Service Down Error Handling
  it('T2-BVA-10: should return SERVICE_UNAVAILABLE when downstream cluster fails', async () => {
    cluster.simulateUnavailable = true;

    const res = await client.graphql(`
      query {
        issues {
          id
        }
      }
    `);

    assert.ok(res.errors);
    assert.equal(res.errors[0].extensions?.code, 'SERVICE_UNAVAILABLE');
  });
});
