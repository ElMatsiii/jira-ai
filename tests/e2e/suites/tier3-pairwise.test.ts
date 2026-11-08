import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCluster } from '../harness/mock-cluster.ts';
import { E2EClient } from '../harness/e2e-client.ts';
import { IssueStatus, IssuePriority, IssueType, SprintStatus, AlertType, AlertSeverity } from '../harness/test-fixtures.ts';

describe('Tier 3: Cross-Feature Combinations & Pairwise Interoperability Suite', () => {
  let cluster: MockCluster;
  let client: E2EClient;
  const bffPort = 14003;
  const mcpPort = 13003;

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

  // PAIR-01 to PAIR-04: BFF GraphQL <-> gRPC Protocol conversions
  it('PAIR-01/02: BFF GraphQL mutations & queries map cleanly to MS1 gRPC IssueService', async () => {
    const priorities = [IssuePriority.ISSUE_PRIORITY_LOW, IssuePriority.ISSUE_PRIORITY_CRITICAL];
    const types = [IssueType.ISSUE_TYPE_BUG, IssueType.ISSUE_TYPE_STORY];

    for (let i = 0; i < priorities.length; i++) {
      const res = await client.graphql(`
        mutation Create($title: String!, $priority: Int!, $type: Int!) {
          createIssue(input: { title: $title, priority: $priority, type: $type, storyPoints: 5 }) {
            id
            key
            priority
            type
          }
        }
      `, {
        title: `Pairwise Matrix Issue ${i}`,
        priority: priorities[i],
        type: types[i],
      });

      assert.ok(res.data?.createIssue);
      assert.equal(res.data.createIssue.priority, priorities[i]);
      assert.equal(res.data.createIssue.type, types[i]);
    }
  });

  it('PAIR-03/04: BFF GraphQL mutations map cleanly to MS2 gRPC SprintService lifecycle', async () => {
    // Create Sprint
    const createRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Pairwise Sprint", goal: "Test state machine" }) {
          id
          status
        }
      }
    `);
    const sprintId = createRes.data.createSprint.id;
    assert.equal(createRes.data.createSprint.status, SprintStatus.SPRINT_STATUS_PLANNED);

    // Start Sprint
    const startRes = await client.graphql(`
      mutation Start($id: ID!) {
        startSprint(id: $id) {
          id
          status
        }
      }
    `, { id: sprintId });
    assert.equal(startRes.data.startSprint.status, SprintStatus.SPRINT_STATUS_ACTIVE);

    // Complete Sprint
    const completeRes = await client.graphql(`
      mutation Complete($id: ID!) {
        completeSprint(id: $id) {
          id
          status
        }
      }
    `, { id: sprintId });
    assert.equal(completeRes.data.completeSprint.status, SprintStatus.SPRINT_STATUS_COMPLETED);
  });

  // PAIR-05 & PAIR-14: BFF <-> Kafka Request-Reply <-> MS3 (.NET)
  it('PAIR-05/14: BFF GraphQL queries coordinate with MS3 via Kafka Request-Reply with matching correlationId', async () => {
    const sprintId = 'sprint-rr-pairwise';
    cluster.sprintsDb.set(sprintId, {
      id: sprintId,
      projectId: 'proj-1',
      name: 'R-R Sprint',
      goal: 'Test Kafka protocol',
      startDate: Date.now(),
      endDate: Date.now() + 14 * 86400000,
      status: SprintStatus.SPRINT_STATUS_ACTIVE,
      totalStoryPoints: 21,
      completedStoryPoints: 13,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await client.graphql(`
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

    assert.ok(res.data?.sprintAnalytics);
    const analytics = res.data.sprintAnalytics;
    assert.equal(analytics.velocity, 13);
    assert.ok(analytics.healthScore > 50);

    // Assert exact Kafka Request-Reply matching in message bus
    const sentQuery = cluster.kafkaAnalyticsQueries.find((q) => q.sprintId === sprintId);
    const sentReply = cluster.kafkaAnalyticsReplies.find((r) => r.sprintId === sprintId);
    assert.ok(sentQuery, 'Kafka query event must exist');
    assert.ok(sentReply, 'Kafka reply event must exist');
    assert.equal(sentQuery.correlationId, sentReply.correlationId);
  });

  // PAIR-06/07/08: BFF GraphQL <-> MCP Agent REST
  it('PAIR-06/07/08: BFF forwards AI operations to MCP Agent REST and maps typed responses', async () => {
    // decomposeEpic
    const decompRes = await client.graphql(`
      mutation Decompose($epicTitle: String!, $projectKey: String!) {
        decomposeEpic(epicTitle: $epicTitle, projectKey: $projectKey) {
          epicTitle
          stories {
            title
            estimatedStoryPoints
            acceptanceCriteriaGherkin
          }
        }
      }
    `, {
      epicTitle: 'Automate Kafka Partitioning',
      projectKey: 'KAFKA',
    });

    assert.ok(decompRes.data?.decomposeEpic);
    assert.equal(decompRes.data.decomposeEpic.epicTitle, 'Automate Kafka Partitioning');
    assert.ok(decompRes.data.decomposeEpic.stories.length > 0);

    // planSprint
    const planRes = await client.graphql(`
      mutation Plan($sprintGoal: String!, $teamCapacityStoryPoints: Int!, $candidateIssues: [CandidateIssueInput]) {
        planSprint(sprintGoal: $sprintGoal, teamCapacityStoryPoints: $teamCapacityStoryPoints, candidateIssues: $candidateIssues) {
          allocatedStoryPoints
          capacityUtilizationPercent
          recommendedIssueIds
        }
      }
    `, {
      sprintGoal: 'Deploy v1',
      teamCapacityStoryPoints: 20,
      candidateIssues: [
        { id: 'iss-a', storyPoints: 8 },
        { id: 'iss-b', storyPoints: 5 },
      ],
    });

    assert.ok(planRes.data?.planSprint);
    assert.equal(planRes.data.planSprint.allocatedStoryPoints, 13);
    assert.deepEqual(planRes.data.planSprint.recommendedIssueIds, ['iss-a', 'iss-b']);
  });

  // PAIR-11, 12, 13: MS1 Domain Events -> Kafka -> MS3 Consumer Burndown Update
  it('PAIR-11/12/13: MS1 status change to DONE triggers MS3 burndown update via Kafka issues.events', async () => {
    // Create Sprint in MS2
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Burndown Event Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;

    // Create Issue in MS1 attached to Sprint
    const issueRes = await client.graphql(`
      mutation {
        createIssue(input: { title: "Task for burndown", storyPoints: 5, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    const issueId = issueRes.data.createIssue.id;

    // Start Sprint
    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);
    let sprint = cluster.sprintsDb.get(sprintId)!;
    assert.equal(sprint.totalStoryPoints, 5);
    assert.equal(sprint.completedStoryPoints, 0);

    // Transition Issue to DONE in MS1
    await client.graphql(`
      mutation {
        updateIssueStatus(id: "${issueId}", status: ${IssueStatus.ISSUE_STATUS_DONE}) {
          id
          status
        }
      }
    `);

    // Verify MS3 consumed the event and updated completed points
    sprint = cluster.sprintsDb.get(sprintId)!;
    assert.equal(sprint.completedStoryPoints, 5);
  });

  // PAIR-15 & PAIR-16: MS3 .NET gRPC Client -> MS2 AlertService
  it('PAIR-15/16: Scope creep detection in MS3 triggers gRPC AlertService in MS2', async () => {
    // Create and start sprint with 10 story points
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Scope Creep Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;

    await client.graphql(`
      mutation {
        createIssue(input: { title: "Baseline Issue", storyPoints: 10, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);

    // Now inject urgent scope: add an 8-point issue (+80% increase > 20% threshold)
    await client.graphql(`
      mutation {
        createIssue(input: { title: "Urgent Injection", storyPoints: 8, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);

    // Verify MS3 triggered MS2 AlertService and alert was stored
    assert.ok(cluster.alertsDb.size > 0, 'Expected AlertService to have received an alert');
    const alert = Array.from(cluster.alertsDb.values())[0];
    assert.equal(alert.sprintId, sprintId);
    assert.equal(alert.alertType, AlertType.ALERT_TYPE_SCOPE_CREEP);
    assert.equal(alert.severity, AlertSeverity.ALERT_SEVERITY_WARNING);

    // Verify alert appears in BFF GraphQL query
    const querySprint = await client.graphql(`
      query {
        sprint(id: "${sprintId}") {
          id
          hasActiveAlerts
          alerts {
            alertType
            severity
            message
          }
        }
      }
    `);

    assert.ok(querySprint.data?.sprint);
    assert.equal(querySprint.data.sprint.hasActiveAlerts, true);
    assert.equal(querySprint.data.sprint.alerts[0].alertType, AlertType.ALERT_TYPE_SCOPE_CREEP);
  });
});
