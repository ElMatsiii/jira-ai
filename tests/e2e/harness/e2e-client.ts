/**
 * Unified E2E Test Client for Jira AI Platform
 * Connects to BFF GraphQL Gateway and MCP Agent REST services.
 */

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: { code?: string };
  }>;
}

export interface RestResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

export class E2EClient {
  public bffUrl: string;
  public mcpUrl: string;

  constructor(bffPort: number = 4000, mcpPort: number = 3000) {
    this.bffUrl = process.env.BFF_URL || `http://localhost:${bffPort}`;
    this.mcpUrl = process.env.MCP_URL || `http://localhost:${mcpPort}`;
  }

  /**
   * Execute GraphQL Query or Mutation against BFF /graphql
   */
  public async graphql<T = any>(query: string, variables: Record<string, any> = {}): Promise<GraphQLResponse<T>> {
    const res = await fetch(`${this.bffUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    return (await res.json()) as GraphQLResponse<T>;
  }

  /**
   * Execute REST POST against MCP Agent
   */
  public async mcpPost<T = any>(endpoint: string, body: Record<string, any> = {}): Promise<RestResponse<T>> {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${this.mcpUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return {
      status: res.status,
      headers: res.headers,
      body: data,
    };
  }

  /**
   * Utility helper to wait for asynchronous conditions with timeout
   */
  public async waitFor(conditionFn: () => boolean | Promise<boolean>, timeoutMs: number = 5000, intervalMs: number = 50): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await conditionFn()) return;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
  }
}
