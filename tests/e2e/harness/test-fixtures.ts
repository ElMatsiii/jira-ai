/**
 * Jira AI Test Fixtures and Interface Definitions
 * Conforming strictly to PROJECT.md and ORIGINAL_REQUEST.md contracts.
 */

export const IssueStatus = {
  ISSUE_STATUS_UNSPECIFIED: 0,
  ISSUE_STATUS_TODO: 1,
  ISSUE_STATUS_IN_PROGRESS: 2,
  ISSUE_STATUS_IN_REVIEW: 3,
  ISSUE_STATUS_DONE: 4,
} as const;
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus];

export const IssuePriority = {
  ISSUE_PRIORITY_UNSPECIFIED: 0,
  ISSUE_PRIORITY_LOW: 1,
  ISSUE_PRIORITY_MEDIUM: 2,
  ISSUE_PRIORITY_HIGH: 3,
  ISSUE_PRIORITY_CRITICAL: 4,
} as const;
export type IssuePriority = (typeof IssuePriority)[keyof typeof IssuePriority];

export const IssueType = {
  ISSUE_TYPE_UNSPECIFIED: 0,
  ISSUE_TYPE_STORY: 1,
  ISSUE_TYPE_TASK: 2,
  ISSUE_TYPE_BUG: 3,
  ISSUE_TYPE_EPIC: 4,
} as const;
export type IssueType = (typeof IssueType)[keyof typeof IssueType];

export const SprintStatus = {
  SPRINT_STATUS_UNSPECIFIED: 0,
  SPRINT_STATUS_PLANNED: 1,
  SPRINT_STATUS_ACTIVE: 2,
  SPRINT_STATUS_COMPLETED: 3,
  SPRINT_STATUS_CANCELLED: 4,
} as const;
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export const AlertType = {
  ALERT_TYPE_UNSPECIFIED: 0,
  ALERT_TYPE_SCOPE_CREEP: 1,
  ALERT_TYPE_VELOCITY_DEFICIT: 2,
  ALERT_TYPE_BOTTLENECK_DETECTED: 3,
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertSeverity = {
  ALERT_SEVERITY_UNSPECIFIED: 0,
  ALERT_SEVERITY_INFO: 1,
  ALERT_SEVERITY_WARNING: 2,
  ALERT_SEVERITY_CRITICAL: 3,
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export interface Issue {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  storyPoints: number;
  sprintId?: string | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  acceptanceCriteria?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: number;
  endDate: number;
  status: SprintStatus;
  totalStoryPoints: number;
  completedStoryPoints: number;
  createdAt: number;
  updatedAt: number;
}

export interface SprintAlert {
  id: string;
  sprintId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface KafkaEventEnvelope<T = any> {
  eventId: string;
  eventType: 'ISSUE_CREATED' | 'ISSUE_UPDATED' | 'ISSUE_STATUS_CHANGED' | 'ISSUE_DELETED';
  timestamp: string;
  producerId: string;
  payload: T;
}

export interface AnalyticsQueryPayload {
  queryId: string;
  correlationId: string;
  sprintId: string;
  queryType: 'BURNDOWN_SERIES' | 'VELOCITY_METRICS' | 'SPRINT_HEALTH';
}

export interface BurndownDataPoint {
  day: number;
  date: string;
  idealRemaining: number;
  actualRemaining: number;
}

export interface AnalyticsReplyPayload {
  replyId: string;
  correlationId: string;
  sprintId: string;
  velocity: number;
  healthScore: number;
  burndownData: BurndownDataPoint[];
  diagnostics: string[];
}

export interface DecomposedStory {
  title: string;
  description: string;
  type: string;
  priority: string;
  estimatedStoryPoints: number;
  acceptanceCriteriaGherkin: string;
}

export interface EpicDecompositionResponse {
  epicTitle: string;
  stories: DecomposedStory[];
}

export interface SprintPlanResponse {
  allocatedStoryPoints: number;
  capacityUtilizationPercent: number;
  recommendedIssueIds: string[];
  riskAssessment: string;
  rationale: string;
}

export interface SprintDiagnosisResponse {
  healthStatus: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  diagnosis: string;
  rootCauses: string[];
  actionableRecommendations: string[];
}

// Canonical Test Fixtures
export const FIXTURES = {
  sampleEpic: {
    projectKey: 'JIRA',
    epicTitle: 'Automated CI/CD Verification & Polyglot Orchestration',
    epicDescription: 'Establish microservices communication across Go, NestJS, and .NET using gRPC and Kafka with automated quality gates.',
  },
  sampleSprint: {
    projectId: 'proj-enterprise-1',
    name: 'Sprint 42 - Polyglot Inception',
    goal: 'Deliver core inter-service communication and GraphQL integration',
    startDate: Date.now(),
    endDate: Date.now() + 14 * 24 * 3600 * 1000, // 14 days
  },
  sampleIssues: [
    {
      title: 'Configure Go gRPC server endpoints',
      description: 'Implement IssueService handlers for CRUD and batch assignment',
      type: IssueType.ISSUE_TYPE_STORY,
      priority: IssuePriority.ISSUE_PRIORITY_HIGH,
      storyPoints: 5,
    },
    {
      title: 'Implement NestJS Kafka Request-Reply client',
      description: 'Send analytics.query and await analytics.reply with correlation header',
      type: IssueType.ISSUE_TYPE_STORY,
      priority: IssuePriority.ISSUE_PRIORITY_HIGH,
      storyPoints: 8,
    },
    {
      title: 'Construct .NET burndown calculation engine',
      description: 'Maintain real-time snapshots in MongoDB on issues.events',
      type: IssueType.ISSUE_TYPE_STORY,
      priority: IssuePriority.ISSUE_PRIORITY_MEDIUM,
      storyPoints: 5,
    },
    {
      title: 'Build GraphQL unified schema in BFF',
      description: 'Expose issues, sprints, and analytics queries over /graphql',
      type: IssueType.ISSUE_TYPE_STORY,
      priority: IssuePriority.ISSUE_PRIORITY_HIGH,
      storyPoints: 3,
    },
  ],
};
