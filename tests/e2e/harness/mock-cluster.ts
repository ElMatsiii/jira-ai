import * as http from 'node:http';
import {
  IssueStatus,
  IssuePriority,
  IssueType,
  SprintStatus,
  AlertType,
  AlertSeverity,
  FIXTURES,
} from './test-fixtures.ts';
import type {
  Issue,
  Sprint,
  SprintAlert,
  KafkaEventEnvelope,
  AnalyticsQueryPayload,
  AnalyticsReplyPayload,
  EpicDecompositionResponse,
  SprintPlanResponse,
  SprintDiagnosisResponse,
} from './test-fixtures.ts';

export interface ClusterOptions {
  bffPort?: number;
  mcpPort?: number;
  simulateKafkaTimeout?: boolean;
  simulateGeminiOffline?: boolean;
  simulateUnavailable?: boolean;
}

export class MockCluster {
  public bffPort: number;
  public mcpPort: number;

  private bffServer?: http.Server;
  private mcpServer?: http.Server;

  // In-memory state representing DBs and Message Queues
  public issuesDb: Map<string, Issue> = new Map();
  public sprintsDb: Map<string, Sprint> = new Map();
  public alertsDb: Map<string, SprintAlert> = new Map();
  public kafkaIssuesEvents: KafkaEventEnvelope[] = [];
  public kafkaAnalyticsQueries: AnalyticsQueryPayload[] = [];
  public kafkaAnalyticsReplies: AnalyticsReplyPayload[] = [];

  // Chaos controls
  public simulateKafkaTimeout: boolean = false;
  public simulateGeminiOffline: boolean = false;
  public simulateUnavailable: boolean = false;

  private issueSequence: number = 100;

  constructor(options: ClusterOptions = {}) {
    this.bffPort = options.bffPort || parseInt(process.env.BFF_PORT || '4000', 10);
    this.mcpPort = options.mcpPort || parseInt(process.env.MCP_PORT || '3000', 10);
    this.simulateKafkaTimeout = !!options.simulateKafkaTimeout;
    this.simulateGeminiOffline = !!options.simulateGeminiOffline;
    this.simulateUnavailable = !!options.simulateUnavailable;
  }

  public async start(): Promise<void> {
    await Promise.all([
      this.startMcpServer(),
      this.startBffServer(),
    ]);
  }

  public async stop(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve) => (this.bffServer ? this.bffServer.close(() => resolve()) : resolve())),
      new Promise<void>((resolve) => (this.mcpServer ? this.mcpServer.close(() => resolve()) : resolve())),
    ]);
  }

  public resetState(): void {
    this.issuesDb.clear();
    this.sprintsDb.clear();
    this.alertsDb.clear();
    this.kafkaIssuesEvents = [];
    this.kafkaAnalyticsQueries = [];
    this.kafkaAnalyticsReplies = [];
    this.simulateKafkaTimeout = false;
    this.simulateGeminiOffline = false;
    this.simulateUnavailable = false;
    this.issueSequence = 100;
  }

  // --- MCP REST Server (:3000) ---
  private startMcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mcpServer = http.createServer(async (req, res) => {
        const url = req.url || '';
        const method = req.method || 'GET';

        if (this.simulateUnavailable) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Service Unavailable' }));
          return;
        }

        const bodyStr = await this.readBody(req);
        let body: any = {};
        if (bodyStr) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            return;
          }
        }

        if (method === 'POST' && url === '/agent/decompose-epic') {
          if (!body.epicTitle) {
            res.writeHead(422, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing mandatory epicTitle' }));
            return;
          }

          const response: EpicDecompositionResponse = {
            epicTitle: body.epicTitle,
            stories: [
              {
                title: `Implement ${body.epicTitle} - Core Data Contracts`,
                description: `Define proto schemas and event definitions for ${body.epicTitle}`,
                type: 'STORY',
                priority: 'HIGH',
                estimatedStoryPoints: 5,
                acceptanceCriteriaGherkin: `Scenario: Successful contract compilation\n  Given valid proto specifications\n  When code generation executes\n  Then Go, TypeScript and C# stubs are generated`,
              },
              {
                title: `Implement ${body.epicTitle} - Inter-Service Logic`,
                description: `Integrate gRPC communication for ${body.epicTitle}`,
                type: 'STORY',
                priority: 'HIGH',
                estimatedStoryPoints: 8,
                acceptanceCriteriaGherkin: `Scenario: gRPC dispatch\n  Given active target microservice\n  When client sends valid RPC request\n  Then response is returned within deadline`,
              },
              {
                title: `Implement ${body.epicTitle} - Event Streaming & Analytics`,
                description: `Emit Kafka events and update real-time metrics`,
                type: 'STORY',
                priority: 'MEDIUM',
                estimatedStoryPoints: 5,
                acceptanceCriteriaGherkin: `Scenario: Kafka event consumption\n  Given issue state change\n  When event is published to issues.events\n  Then burndown snapshot is updated in MongoDB`,
              },
            ],
          };

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'x-ai-engine': this.simulateGeminiOffline ? 'offline-heuristic' : 'gemini-2.0-flash',
          });
          res.end(JSON.stringify(response));
          return;
        }

        if (method === 'POST' && url === '/agent/plan-sprint') {
          const capacity = body.teamCapacityStoryPoints || 20;
          const candidateIssues: any[] = body.candidateIssues || [];
          let allocated = 0;
          const recommended: string[] = [];

          for (const issue of candidateIssues) {
            const pts = issue.storyPoints || 3;
            if (allocated + pts <= capacity) {
              allocated += pts;
              recommended.push(issue.id);
            }
          }

          const response: SprintPlanResponse = {
            allocatedStoryPoints: allocated,
            capacityUtilizationPercent: Math.round((allocated / capacity) * 100),
            recommendedIssueIds: recommended,
            riskAssessment: allocated > capacity * 0.9 ? 'MEDIUM_CAPACITY_RISK' : 'OPTIMAL',
            rationale: `Selected ${recommended.length} candidate issues matching team velocity capacity of ${capacity} points.`,
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        }

        if (method === 'POST' && url === '/agent/diagnose-metrics') {
          const burndown: any[] = body.burndownData || [];
          const blockedCount = body.blockedIssuesCount || 0;
          const isLagging = burndown.length > 2 && burndown[burndown.length - 1]?.actualRemaining > burndown[burndown.length - 1]?.idealRemaining;

          const response: SprintDiagnosisResponse = {
            healthStatus: isLagging || blockedCount > 0 ? 'AT_RISK' : 'HEALTHY',
            diagnosis: isLagging
              ? 'Actual burndown is trending above ideal rate. Sprint delivery is at risk of velocity deficit.'
              : 'Sprint burndown is tracking along ideal trajectory.',
            rootCauses: blockedCount > 0 ? [`${blockedCount} issues currently blocked in code review`] : ['Unplanned scope addition mid-sprint'],
            actionableRecommendations: [
              'Conduct swarming session on blocked PRs',
              'Defer lower-priority backlog stories to preserve sprint goal commitment',
            ],
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Route not found: ${method} ${url}` }));
      });

      this.mcpServer.listen(this.mcpPort, () => resolve());
      this.mcpServer.on('error', reject);
    });
  }

  // --- BFF GraphQL Server (:4000) ---
  private startBffServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bffServer = http.createServer(async (req, res) => {
        const url = req.url || '';
        const method = req.method || 'GET';

        if (this.simulateUnavailable) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: 'Service Unavailable', extensions: { code: 'SERVICE_UNAVAILABLE' } }] }));
          return;
        }

        if (url === '/graphql') {
          if (method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errors: [{ message: 'Method Not Allowed' }] }));
            return;
          }

          const bodyStr = await this.readBody(req);
          let payload: any = {};
          try {
            payload = JSON.parse(bodyStr);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errors: [{ message: 'Invalid JSON query payload' }] }));
            return;
          }

          const { query, variables } = payload;
          if (!query || typeof query !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errors: [{ message: 'Missing GraphQL query string' }] }));
            return;
          }

          try {
            const result = await this.handleGraphQL(query, variables || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              data: null,
              errors: [{ message: err.message, extensions: { code: err.code || 'INTERNAL_SERVER_ERROR' } }],
            }));
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.bffServer.listen(this.bffPort, () => resolve());
      this.bffServer.on('error', reject);
    });
  }

  // GraphQL Resolver Dispatcher
  private async handleGraphQL(query: string, vars: Record<string, any>): Promise<any> {
    const trimmed = query.trim();

    // Introspection query
    if (trimmed.includes('__schema') || trimmed.includes('__type')) {
      return {
        data: {
          __schema: {
            types: [
              { name: 'Query' },
              { name: 'Mutation' },
              { name: 'Issue' },
              { name: 'Sprint' },
              { name: 'SprintAnalytics' },
            ],
          },
        },
      };
    }

    // --- MUTATIONS ---
    if (trimmed.startsWith('mutation')) {
      // createIssue
      if (trimmed.includes('createIssue')) {
        const input = vars.input || vars;
        const title = input.title || this.extractArg(query, 'title');
        if (!title) {
          throw Object.assign(new Error('Variable "title" is required'), { code: 'BAD_USER_INPUT' });
        }
        const id = `issue-${++this.issueSequence}`;
        const key = `${input.projectKey || this.extractArg(query, 'projectKey') || 'JIRA'}-${this.issueSequence}`;
        const storyPoints = input.storyPoints !== undefined ? input.storyPoints : (this.extractNumArg(query, 'storyPoints') ?? 0);
        const sprintId = input.sprintId !== undefined ? input.sprintId : (this.extractArg(query, 'sprintId') || null);
        const priority = input.priority !== undefined ? input.priority : (this.extractNumArg(query, 'priority') ?? IssuePriority.ISSUE_PRIORITY_MEDIUM);
        const type = input.type !== undefined ? input.type : (this.extractNumArg(query, 'type') ?? IssueType.ISSUE_TYPE_STORY);
        const projectId = input.projectId || this.extractArg(query, 'projectId') || 'proj-1';
        const description = input.description || this.extractArg(query, 'description') || '';

        const issue: Issue = {
          id,
          key,
          projectId,
          title,
          description,
          status: IssueStatus.ISSUE_STATUS_TODO,
          priority: priority as any,
          type: type as any,
          storyPoints,
          sprintId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        this.issuesDb.set(id, issue);

        // MS1 emits Kafka event
        const event: KafkaEventEnvelope = {
          eventId: `evt-${Date.now()}-${id}`,
          eventType: 'ISSUE_CREATED',
          timestamp: new Date().toISOString(),
          producerId: 'ms1-issues-go',
          payload: issue,
        };
        this.kafkaIssuesEvents.push(event);

        // Check if attached to active sprint -> update sprint points in MS2 / MS3
        if (issue.sprintId && this.sprintsDb.has(issue.sprintId)) {
          const sprint = this.sprintsDb.get(issue.sprintId)!;
          const oldPoints = sprint.totalStoryPoints;
          sprint.totalStoryPoints += issue.storyPoints;

          // Scope creep detection: if sprint was active and points increase > 20%
          if (sprint.status === SprintStatus.SPRINT_STATUS_ACTIVE && oldPoints > 0) {
            const increasePercent = (issue.storyPoints / oldPoints) * 100;
            if (increasePercent >= 20) {
              const alertId = `alert-${Date.now()}`;
              const alert: SprintAlert = {
                id: alertId,
                sprintId: sprint.id,
                alertType: AlertType.ALERT_TYPE_SCOPE_CREEP,
                severity: AlertSeverity.ALERT_SEVERITY_WARNING,
                message: `Scope creep detected: +${issue.storyPoints} points added to active sprint (${Math.round(increasePercent)}% increase).`,
                timestamp: Date.now(),
                acknowledged: false,
              };
              this.alertsDb.set(alertId, alert);
            }
          }
        }

        return { data: { createIssue: issue } };
      }

      // updateIssueStatus
      if (trimmed.includes('updateIssueStatus')) {
        const id = vars.id || this.extractArg(query, 'id') || '';
        const newStatus = vars.status !== undefined ? vars.status : (this.extractNumArg(query, 'status') ?? 0);
        const issue = this.issuesDb.get(id);
        if (!issue) {
          throw Object.assign(new Error(`Issue ${id} not found`), { code: 'NOT_FOUND' });
        }
        const oldStatus = issue.status;
        issue.status = newStatus as any;
        issue.updatedAt = Date.now();

        // Kafka event
        this.kafkaIssuesEvents.push({
          eventId: `evt-${Date.now()}-${id}`,
          eventType: 'ISSUE_STATUS_CHANGED',
          timestamp: new Date().toISOString(),
          producerId: 'ms1-issues-go',
          payload: { id, oldStatus, newStatus, sprintId: issue.sprintId },
        });

        // MS3 consumer updates completed points if DONE
        if (newStatus === IssueStatus.ISSUE_STATUS_DONE && issue.sprintId && this.sprintsDb.has(issue.sprintId)) {
          const sprint = this.sprintsDb.get(issue.sprintId)!;
          sprint.completedStoryPoints += issue.storyPoints;
        }

        return { data: { updateIssueStatus: issue } };
      }

      // createSprint
      if (trimmed.includes('createSprint')) {
        const input = vars.input || vars;
        const name = input.name || this.extractArg(query, 'name') || 'Sprint';
        const goal = input.goal || this.extractArg(query, 'goal') || '';
        const projectId = input.projectId || this.extractArg(query, 'projectId') || 'proj-1';
        const id = `sprint-${Date.now()}`;
        const sprint: Sprint = {
          id,
          projectId,
          name,
          goal,
          startDate: input.startDate || this.extractNumArg(query, 'startDate') || Date.now(),
          endDate: input.endDate || this.extractNumArg(query, 'endDate') || Date.now() + 14 * 86400000,
          status: SprintStatus.SPRINT_STATUS_PLANNED,
          totalStoryPoints: 0,
          completedStoryPoints: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.sprintsDb.set(id, sprint);
        return { data: { createSprint: sprint } };
      }

      // startSprint
      if (trimmed.includes('startSprint')) {
        const id = vars.id || this.extractArg(query, 'id') || '';
        const sprint = this.sprintsDb.get(id);
        if (!sprint) {
          throw Object.assign(new Error(`Sprint ${id} not found`), { code: 'NOT_FOUND' });
        }
        // Inter-service call: MS2 calls MS1 to batch fetch and sum points
        let totalPoints = 0;
        for (const issue of this.issuesDb.values()) {
          if (issue.sprintId === id) {
            totalPoints += issue.storyPoints;
          }
        }
        sprint.totalStoryPoints = totalPoints;
        sprint.status = SprintStatus.SPRINT_STATUS_ACTIVE;
        sprint.updatedAt = Date.now();
        return { data: { startSprint: sprint } };
      }

      // completeSprint
      if (trimmed.includes('completeSprint')) {
        const id = vars.id || this.extractArg(query, 'id') || '';
        const sprint = this.sprintsDb.get(id);
        if (!sprint) {
          throw Object.assign(new Error(`Sprint ${id} not found`), { code: 'NOT_FOUND' });
        }
        sprint.status = SprintStatus.SPRINT_STATUS_COMPLETED;
        sprint.updatedAt = Date.now();
        return { data: { completeSprint: sprint } };
      }

      // decomposeEpic
      if (trimmed.includes('decomposeEpic')) {
        const res = await fetch(`http://localhost:${this.mcpPort}/agent/decompose-epic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vars),
        });
        if (!res.ok) {
          throw Object.assign(new Error(`MCP Agent error: ${res.statusText}`), { code: 'AI_SERVICE_UNAVAILABLE' });
        }
        const json = await res.json();
        return { data: { decomposeEpic: json } };
      }

      // planSprint
      if (trimmed.includes('planSprint')) {
        const res = await fetch(`http://localhost:${this.mcpPort}/agent/plan-sprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vars),
        });
        if (!res.ok) {
          throw Object.assign(new Error(`MCP Agent error: ${res.statusText}`), { code: 'AI_SERVICE_UNAVAILABLE' });
        }
        const json = await res.json();
        return { data: { planSprint: json } };
      }

      // diagnoseSprint
      if (trimmed.includes('diagnoseSprint')) {
        const res = await fetch(`http://localhost:${this.mcpPort}/agent/diagnose-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vars),
        });
        if (!res.ok) {
          throw Object.assign(new Error(`MCP Agent error: ${res.statusText}`), { code: 'AI_SERVICE_UNAVAILABLE' });
        }
        const json = await res.json();
        return { data: { diagnoseSprint: json } };
      }
    }

    // --- QUERIES ---
    // issue(id)
    if (trimmed.includes('issue(') || (trimmed.includes('query') && trimmed.includes('issue('))) {
      const id = vars.id || this.extractArg(query, 'id') || '';
      const issue = this.issuesDb.get(id);
      return { data: { issue: issue || null } };
    }

    // issues
    if (trimmed.includes('issues(') || trimmed.includes('issues {') || trimmed.includes('issues{')) {
      const sprintId = vars.sprintId || this.extractArg(query, 'sprintId');
      const projectId = vars.projectId || this.extractArg(query, 'projectId');
      let list = Array.from(this.issuesDb.values());
      if (sprintId) list = list.filter((i) => i.sprintId === sprintId);
      if (projectId) list = list.filter((i) => i.projectId === projectId);
      return { data: { issues: list } };
    }

    // sprint(id)
    if (trimmed.includes('sprint(') || (trimmed.includes('query') && trimmed.includes('sprint('))) {
      const id = vars.id || this.extractArg(query, 'id') || '';
      const sprint = this.sprintsDb.get(id);
      if (sprint) {
        const alerts = Array.from(this.alertsDb.values()).filter((a) => a.sprintId === id);
        return {
          data: {
            sprint: {
              ...sprint,
              hasActiveAlerts: alerts.length > 0,
              alerts,
            },
          },
        };
      }
      return { data: { sprint: null } };
    }

    // sprints
    if (trimmed.includes('sprints(') || trimmed.includes('sprints {') || trimmed.includes('sprints{')) {
      return { data: { sprints: Array.from(this.sprintsDb.values()) } };
    }

    // sprintAnalytics
    if (trimmed.includes('sprintAnalytics')) {
      if (this.simulateKafkaTimeout) {
        throw Object.assign(new Error('Kafka Request-Reply timeout after 5000ms'), { code: 'GATEWAY_TIMEOUT' });
      }

      const sprintId = vars.sprintId || vars.id || this.extractArg(query, 'sprintId') || '';
      const sprint = this.sprintsDb.get(sprintId);
      const totalPoints = sprint ? sprint.totalStoryPoints : 20;
      const completed = sprint ? sprint.completedStoryPoints : 0;
      const remaining = Math.max(0, totalPoints - completed);

      // Record simulated Kafka Request-Reply
      const correlationId = `corr-${Date.now()}`;
      const queryPayload: AnalyticsQueryPayload = {
        queryId: `qry-${Date.now()}`,
        correlationId,
        sprintId,
        queryType: 'BURNDOWN_SERIES',
      };
      this.kafkaAnalyticsQueries.push(queryPayload);

      const replyPayload: AnalyticsReplyPayload = {
        replyId: `rep-${Date.now()}`,
        correlationId,
        sprintId,
        velocity: completed,
        healthScore: remaining === 0 ? 100 : Math.round((completed / (totalPoints || 1)) * 100),
        burndownData: [
          { day: 1, date: '2026-10-20', idealRemaining: totalPoints, actualRemaining: totalPoints },
          { day: 5, date: '2026-10-24', idealRemaining: Math.round(totalPoints * 0.65), actualRemaining: remaining },
        ],
        diagnostics: [],
      };
      this.kafkaAnalyticsReplies.push(replyPayload);

      return { data: { sprintAnalytics: replyPayload } };
    }

    return { data: null };
  }

  private extractArg(text: string, key: string): string | undefined {
    const match = text.match(new RegExp(`${key}:\\s*"([^"]+)"`));
    return match ? match[1] : undefined;
  }

  private extractNumArg(text: string, key: string): number | undefined {
    const match = text.match(new RegExp(`${key}:\\s*(\\d+)`));
    return match ? parseInt(match[1], 10) : undefined;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
    });
  }
}
