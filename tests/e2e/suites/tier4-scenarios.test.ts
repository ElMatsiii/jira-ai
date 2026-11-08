import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCluster } from '../harness/mock-cluster.ts';
import { E2EClient } from '../harness/e2e-client.ts';
import { IssueStatus, IssuePriority, IssueType, SprintStatus, AlertType, AlertSeverity } from '../harness/test-fixtures.ts';

describe('Tier 4: Real-World Workload Scenarios Suite', () => {
  let cluster: MockCluster;
  let client: E2EClient;
  const bffPort = 14004;
  const mcpPort = 13004;

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

  // SCENARIO 1: Greenfield Inception & AI Sprint Inception
  it('Scenario 1: Greenfield Inception & AI Sprint Inception', async () => {
    // 1. PO decomposes Epic using AI MCP Agent
    const decompRes = await client.graphql(`
      mutation DecomposeEpic($epicTitle: String!, $projectKey: String!) {
        decomposeEpic(epicTitle: $epicTitle, projectKey: $projectKey) {
          epicTitle
          stories {
            title
            description
            estimatedStoryPoints
            acceptanceCriteriaGherkin
          }
        }
      }
    `, {
      epicTitle: 'Automated CI/CD Verification & Polyglot Orchestration',
      projectKey: 'JIRA',
    });

    assert.ok(decompRes.data?.decomposeEpic);
    const stories = decompRes.data.decomposeEpic.stories;
    assert.ok(stories.length >= 3, 'AI should generate at least 3 user stories');

    // 2. Ingest generated stories into MS1 (Go) via BFF GraphQL
    const createdIssueIds: string[] = [];
    for (const story of stories) {
      const issueRes = await client.graphql(`
        mutation CreateStory($input: CreateIssueInput!) {
          createIssue(input: $input) {
            id
            key
            title
            storyPoints
            status
          }
        }
      `, {
        input: {
          projectKey: 'JIRA',
          title: story.title,
          description: story.description,
          storyPoints: story.estimatedStoryPoints,
          type: IssueType.ISSUE_TYPE_STORY,
          priority: IssuePriority.ISSUE_PRIORITY_HIGH,
        },
      });
      assert.ok(issueRes.data?.createIssue);
      createdIssueIds.push(issueRes.data.createIssue.id);
    }
    assert.equal(createdIssueIds.length, stories.length);
    assert.equal(cluster.kafkaIssuesEvents.length, stories.length);

    // 3. Create a planned Sprint in MS2 (NestJS)
    const sprintRes = await client.graphql(`
      mutation CreateSprint($input: CreateSprintInput!) {
        createSprint(input: $input) {
          id
          name
          status
        }
      }
    `, {
      input: {
        projectId: 'proj-enterprise',
        name: 'Sprint 1 - Inception',
        goal: 'Deliver core microservice communication stubs and CI gates',
      },
    });
    const sprintId = sprintRes.data.createSprint.id;
    assert.equal(sprintRes.data.createSprint.status, SprintStatus.SPRINT_STATUS_PLANNED);

    // 4. Use AI Capacity Planner to allocate stories to Sprint
    const candidateIssues = createdIssueIds.map((id) => ({
      id,
      storyPoints: cluster.issuesDb.get(id)!.storyPoints,
    }));

    const planRes = await client.graphql(`
      mutation PlanSprint($sprintGoal: String!, $teamCapacityStoryPoints: Int!, $candidateIssues: [CandidateIssueInput]) {
        planSprint(sprintGoal: $sprintGoal, teamCapacityStoryPoints: $teamCapacityStoryPoints, candidateIssues: $candidateIssues) {
          allocatedStoryPoints
          capacityUtilizationPercent
          recommendedIssueIds
          rationale
        }
      }
    `, {
      sprintGoal: 'Deliver core microservice communication stubs and CI gates',
      teamCapacityStoryPoints: 20,
      candidateIssues,
    });

    assert.ok(planRes.data?.planSprint);
    assert.ok(planRes.data.planSprint.allocatedStoryPoints > 0);
    assert.ok(planRes.data.planSprint.recommendedIssueIds.length > 0);

    // 5. Batch assign recommended issues to the Sprint in MS1
    for (const id of planRes.data.planSprint.recommendedIssueIds) {
      const issue = cluster.issuesDb.get(id)!;
      issue.sprintId = sprintId;
    }

    // 6. Start the Sprint in MS2
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
    assert.equal(startRes.data.startSprint.totalStoryPoints, planRes.data.planSprint.allocatedStoryPoints);
  });

  // SCENARIO 2: Active Sprint Execution & Scrum Board Transition
  it('Scenario 2: Active Sprint Execution & Scrum Board Transition', async () => {
    // 1. Setup active sprint with 2 issues (5 pts + 8 pts = 13 pts)
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Active Execution Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;

    const iss1 = await client.graphql(`
      mutation {
        createIssue(input: { title: "Card 1", storyPoints: 5, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    const iss2 = await client.graphql(`
      mutation {
        createIssue(input: { title: "Card 2", storyPoints: 8, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    const id1 = iss1.data.createIssue.id;
    const id2 = iss2.data.createIssue.id;

    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);

    // 2. Developer picks up Card 1: TODO -> IN_PROGRESS
    const drag1 = await client.graphql(`
      mutation {
        updateIssueStatus(id: "${id1}", status: ${IssueStatus.ISSUE_STATUS_IN_PROGRESS}) {
          id
          status
        }
      }
    `);
    assert.equal(drag1.data.updateIssueStatus.status, IssueStatus.ISSUE_STATUS_IN_PROGRESS);

    // 3. Developer moves Card 1 to IN_REVIEW then DONE
    await client.graphql(`
      mutation {
        updateIssueStatus(id: "${id1}", status: ${IssueStatus.ISSUE_STATUS_IN_REVIEW}) {
          id
        }
      }
    `);
    const done1 = await client.graphql(`
      mutation {
        updateIssueStatus(id: "${id1}", status: ${IssueStatus.ISSUE_STATUS_DONE}) {
          id
          status
        }
      }
    `);
    assert.equal(done1.data.updateIssueStatus.status, IssueStatus.ISSUE_STATUS_DONE);

    // 4. Mobile loads live Burndown Chart via BFF GraphQL -> Kafka R-R -> MS3
    const analyticsRes = await client.graphql(`
      query GetBurndown($sprintId: ID!) {
        sprintAnalytics(sprintId: $sprintId) {
          sprintId
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
    assert.equal(analytics.velocity, 5); // 5 story points completed
    assert.ok(analytics.healthScore > 0);
  });

  // SCENARIO 3: Sprint Mid-Flight Scope Creep & Automated Bottleneck Alerting
  it('Scenario 3: Sprint Mid-Flight Scope Creep & Automated Bottleneck Alerting', async () => {
    // 1. Active sprint with 10 total points
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Scope Creep Monitoring Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;

    await client.graphql(`
      mutation {
        createIssue(input: { title: "Base Task", storyPoints: 10, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);
    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);

    // 2. Stakeholder injects unexpected 8-point issue (+80% jump > 20% limit)
    await client.graphql(`
      mutation {
        createIssue(input: { title: "Urgent Hotfix Mid-Sprint", storyPoints: 8, sprintId: "${sprintId}" }) {
          id
        }
      }
    `);

    // 3. Verify MS3 detected scope creep and invoked MS2 AlertService via gRPC
    const alerts = Array.from(cluster.alertsDb.values()).filter((a) => a.sprintId === sprintId);
    assert.ok(alerts.length > 0, 'Expected AlertService in MS2 to have recorded scope creep alert');
    assert.equal(alerts[0].alertType, AlertType.ALERT_TYPE_SCOPE_CREEP);
    assert.equal(alerts[0].severity, AlertSeverity.ALERT_SEVERITY_WARNING);

    // 4. Verify mobile query returns alert in sprint details
    const sprintQuery = await client.graphql(`
      query {
        sprint(id: "${sprintId}") {
          id
          totalStoryPoints
          hasActiveAlerts
          alerts {
            alertType
            severity
            message
          }
        }
      }
    `);
    assert.equal(sprintQuery.data.sprint.totalStoryPoints, 18);
    assert.equal(sprintQuery.data.sprint.hasActiveAlerts, true);
    assert.ok(sprintQuery.data.sprint.alerts[0].message.includes('Scope creep detected'));
  });

  // SCENARIO 4: AI Scrum Master Sprint Retrospective & Metric Diagnosis
  it('Scenario 4: AI Scrum Master Sprint Retrospective & Metric Diagnosis', async () => {
    // 1. Complete sprint analytics data retrieved
    const diagRes = await client.graphql(`
      mutation DiagnoseSprint($sprintId: String!, $burndownData: [BurndownDataPointInput], $blockedIssuesCount: Int) {
        diagnoseSprint(sprintId: $sprintId, burndownData: $burndownData, blockedIssuesCount: $blockedIssuesCount) {
          healthStatus
          diagnosis
          rootCauses
          actionableRecommendations
        }
      }
    `, {
      sprintId: 'sprint-retro-4',
      burndownData: [
        { day: 1, idealRemaining: 30, actualRemaining: 30 },
        { day: 7, idealRemaining: 15, actualRemaining: 24 },
        { day: 14, idealRemaining: 0, actualRemaining: 10 },
      ],
      blockedIssuesCount: 3,
    });

    assert.ok(diagRes.data?.diagnoseSprint);
    const diagnosis = diagRes.data.diagnoseSprint;
    assert.equal(diagnosis.healthStatus, 'AT_RISK');
    assert.ok(diagnosis.rootCauses.length > 0);
    assert.ok(diagnosis.actionableRecommendations.length >= 2);

    // 2. Complete the sprint in MS2
    const sprintRes = await client.graphql(`
      mutation {
        createSprint(input: { name: "Retrospective Sprint" }) {
          id
        }
      }
    `);
    const sprintId = sprintRes.data.createSprint.id;
    await client.graphql(`mutation { startSprint(id: "${sprintId}") { id } }`);
    const completeRes = await client.graphql(`mutation { completeSprint(id: "${sprintId}") { id status } }`);
    assert.equal(completeRes.data.completeSprint.status, SprintStatus.SPRINT_STATUS_COMPLETED);
  });

  // SCENARIO 5: Catastrophic Resilience & Partial Degradation Workload
  it('Scenario 5: Catastrophic Resilience & Partial Degradation Workload', async () => {
    // 1. Simulate Kafka broker delay exceeding 5000ms timeout
    cluster.simulateKafkaTimeout = true;
    const timeoutRes = await client.graphql(`
      query {
        sprintAnalytics(sprintId: "sprint-chaos") {
          sprintId
        }
      }
    `);
    assert.ok(timeoutRes.errors);
    assert.equal(timeoutRes.errors[0].extensions?.code, 'GATEWAY_TIMEOUT');
    cluster.simulateKafkaTimeout = false; // Recover Kafka

    // 2. Simulate Gemini AI rate limit (429) -> seamlessly falls back to offline heuristic engine
    cluster.simulateGeminiOffline = true;
    const aiRes = await client.mcpPost('/agent/decompose-epic', {
      epicTitle: 'High-Throughput Ingestion Engine',
      epicDescription: 'Process 10,000 Kafka messages per second without backpressure',
    });

    assert.equal(aiRes.status, 200);
    assert.equal(aiRes.headers.get('x-ai-engine'), 'offline-heuristic');
    assert.ok(aiRes.body.stories.length > 0);
    cluster.simulateGeminiOffline = false; // Recover Gemini

    // 3. Verify standard operations function normally after clearing chaos flags
    const normalRes = await client.graphql(`
      mutation {
        createIssue(input: { title: "Post-Recovery Story", storyPoints: 3 }) {
          id
          title
        }
      }
    `);
    assert.ok(normalRes.data?.createIssue);
    assert.equal(normalRes.data.createIssue.title, 'Post-Recovery Story');
  });
});
