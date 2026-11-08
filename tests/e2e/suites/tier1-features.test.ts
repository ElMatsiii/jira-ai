import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCluster } from '../harness/mock-cluster.ts';
import { E2EClient } from '../harness/e2e-client.ts';
import { IssueStatus, IssuePriority, IssueType, SprintStatus } from '../harness/test-fixtures.ts';

describe('Tier 1: Core Feature Coverage Suite', () => {
  let cluster: MockCluster;
  let client: E2EClient;
  const bffPort = 14001;
  const mcpPort = 13001;

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

  // Feature 1, 8, 10, 30: Issue Management
  it('T1-F1/F8/F10: should create an issue via GraphQL and store it in MS1', async () => {
    const res = await client.graphql(`
      mutation CreateIssue($input: CreateIssueInput!) {
        createIssue(input: $input) {
          id
          key
          title
          status
          priority
          type
          storyPoints
        }
      }
    `, {
      input: {
        title: 'Define issues.proto contract',
        description: 'Create protobuf specifications for Issue and Project entities',
        priority: IssuePriority.ISSUE_PRIORITY_HIGH,
        type: IssueType.ISSUE_TYPE_TASK,
        storyPoints: 5,
      },
    });

    assert.ok(res.data, 'Expected response data');
    assert.ok(res.data.createIssue.id.startsWith('issue-'));
    assert.equal(res.data.createIssue.title, 'Define issues.proto contract');
    assert.equal(res.data.createIssue.status, IssueStatus.ISSUE_STATUS_TODO);
    assert.equal(res.data.createIssue.storyPoints, 5);
  });

  it('T1-F1/F10: should retrieve an issue by ID', async () => {
    const createRes = await client.graphql(`
      mutation {
        createIssue(input: { title: "Test Query Issue", storyPoints: 3 }) {
          id
        }
      }
    `);
    const issueId = createRes.data.createIssue.id;

    const queryRes = await client.graphql(`
      query GetIssue($id: ID!) {
        issue(id: $id) {
          id
          title
          storyPoints
        }
      }
    `, { id: issueId });

    assert.ok(queryRes.data?.issue);
    assert.equal(queryRes.data.issue.id, issueId);
    assert.equal(queryRes.data.issue.title, 'Test Query Issue');
  });

  it('T1-F1/F8: should update issue status from TODO to IN_PROGRESS and emit Kafka event', async () => {
    const createRes = await client.graphql(`
      mutation {
        createIssue(input: { title: "Status Transition Issue", storyPoints: 2 }) {
          id
        }
      }
    `);
    const issueId = createRes.data.createIssue.id;

    const updateRes = await client.graphql(`
      mutation UpdateStatus($id: ID!, $status: Int!) {
        updateIssueStatus(id: $id, status: $status) {
          id
          status
        }
      }
    `, { id: issueId, status: IssueStatus.ISSUE_STATUS_IN_PROGRESS });

    assert.equal(updateRes.data?.updateIssueStatus.status, IssueStatus.ISSUE_STATUS_IN_PROGRESS);

    // Verify Kafka domain event published
    const event = cluster.kafkaIssuesEvents.find(
      (e) => e.eventType === 'ISSUE_STATUS_CHANGED' && e.payload.id === issueId
    );
    assert.ok(event, 'Expected ISSUE_STATUS_CHANGED event in Kafka topic');
    assert.equal(event.payload.newStatus, IssueStatus.ISSUE_STATUS_IN_PROGRESS);
  });

  // Feature 2, 13, 15, 30: Sprint Management
  it('T1-F2/F13/F15: should create, start, and complete a sprint', async () => {
    const createSprintRes = await client.graphql(`
      mutation CreateSprint($input: CreateSprintInput!) {
        createSprint(input: $input) {
          id
          name
          status
        }
      }
    `, {
      input: {
        name: 'Sprint 1 - Foundation',
        goal: 'Complete architecture setup',
      },
    });

    const sprintId = createSprintRes.data.createSprint.id;
    assert.equal(createSprintRes.data.createSprint.status, SprintStatus.SPRINT_STATUS_PLANNED);

    // Attach an issue to this sprint
    await client.graphql(`
      mutation {
        createIssue(input: { title: "Sprint Task", storyPoints: 8, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);

    // Start sprint
    const startRes = await client.graphql(`
      mutation StartSprint($id: ID!) {
        startSprint(id: $id) {
          id
          status
          totalStoryPoints
        }
      }
    `, { id: sprintId });

    assert.equal(startRes.data.startSprint.status, SprintStatus.SPRINT_STATUS_ACTIVE);
    assert.equal(startRes.data.startSprint.totalStoryPoints, 8);

    // Complete sprint
    const completeRes = await client.graphql(`
      mutation CompleteSprint($id: ID!) {
        completeSprint(id: $id) {
          id
          status
        }
      }
    `, { id: sprintId });

    assert.equal(completeRes.data.completeSprint.status, SprintStatus.SPRINT_STATUS_COMPLETED);
  });

  // Feature 4, 5, 17, 22, 32: Kafka Request-Reply Analytics
  it('T1-F4/F5/F17/F22: should resolve sprint analytics via Kafka Request-Reply with correlationId', async () => {
    // Create and start a sprint with 13 points
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Analytics Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;
    await client.graphql(`
      mutation {
        createIssue(input: { title: "Heavy Task", storyPoints: 13, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);

    // Query analytics via GraphQL
    const analyticsRes = await client.graphql(`
      query GetAnalytics($sprintId: ID!) {
        sprintAnalytics(sprintId: $sprintId) {
          sprintId
          correlationId
          velocity
          healthScore
          burndownData {
            day
            idealRemaining
            actualRemaining
          }
        }
      }
    `, { sprintId });

    assert.ok(analyticsRes.data?.sprintAnalytics);
    const analytics = analyticsRes.data.sprintAnalytics;
    assert.equal(analytics.sprintId, sprintId);
    assert.ok(analytics.correlationId.startsWith('corr-'));
    assert.ok(Array.isArray(analytics.burndownData));
    assert.ok(analytics.burndownData.length > 0);

    // Verify Kafka message history in cluster
    assert.equal(cluster.kafkaAnalyticsQueries.length, 1);
    assert.equal(cluster.kafkaAnalyticsReplies.length, 1);
    assert.equal(cluster.kafkaAnalyticsQueries[0].correlationId, cluster.kafkaAnalyticsReplies[0].correlationId);
  });

  // Feature 25, 26, 27, 28: MCP Agent REST Endpoints
  it('T1-F27/F28: should decompose an epic into user stories via REST endpoint', async () => {
    const res = await client.mcpPost('/agent/decompose-epic', {
      epicTitle: 'User Authentication & Multi-Tenancy',
      epicDescription: 'Support OAuth2, JWT verification, and organization tenant isolation',
      projectKey: 'AUTH',
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.stories);
    assert.ok(res.body.stories.length >= 3);
    for (const story of res.body.stories) {
      assert.ok(story.title);
      assert.ok(story.estimatedStoryPoints > 0);
      assert.ok(story.acceptanceCriteriaGherkin.includes('Scenario:'));
    }
  });

  it('T1-F27/F28: should plan sprint capacity via REST endpoint', async () => {
    const res = await client.mcpPost('/agent/plan-sprint', {
      sprintGoal: 'Deliver MVP release',
      teamCapacityStoryPoints: 15,
      candidateIssues: [
        { id: 'iss-1', storyPoints: 5 },
        { id: 'iss-2', storyPoints: 8 },
        { id: 'iss-3', storyPoints: 5 },
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.allocatedStoryPoints, 13);
    assert.deepEqual(res.body.recommendedIssueIds, ['iss-1', 'iss-2']);
    assert.ok(res.body.capacityUtilizationPercent > 80);
  });

  it('T1-F27/F28: should diagnose sprint metrics via REST endpoint', async () => {
    const res = await client.mcpPost('/agent/diagnose-metrics', {
      sprintId: 'sprint-diag-1',
      burndownData: [
        { day: 1, idealRemaining: 20, actualRemaining: 20 },
        { day: 5, idealRemaining: 12, actualRemaining: 18 },
      ],
      blockedIssuesCount: 2,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.healthStatus, 'AT_RISK');
    assert.ok(res.body.rootCauses.length > 0);
    assert.ok(res.body.actionableRecommendations.length > 0);
  });
});
