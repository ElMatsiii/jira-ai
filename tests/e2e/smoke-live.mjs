const bffUrl = (process.env.BFF_URL || 'http://localhost:4000').replace(/\/+$/, '');
const mcpUrl = (process.env.MCP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const webUrl = process.env.WEB_URL || 'http://localhost:5173';
const failures = [];

async function check(name, url, validate, init) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    validate(response, body);
    console.log(`PASS ${name}: ${url}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await check('Web frontend', webUrl, (_response, body) => {
  if (!body.toLowerCase().includes('<html')) {
    throw new Error('response does not look like an HTML page');
  }
});

await check('MCP agent health', `${mcpUrl}/healthz`, (response, body) => {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('expected a JSON health response');
  }

  const health = JSON.parse(body);
  if (health.status !== 'ok') {
    throw new Error(`unexpected health status: ${health.status}`);
  }
});

await check('BFF GraphQL', `${bffUrl}/graphql`, (_response, body) => {
  const result = JSON.parse(body);
  if (result.errors?.length || result.data?.__typename !== 'Query') {
    throw new Error(`GraphQL query failed: ${body.slice(0, 300)}`);
  }
}, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: '{ __typename }' }),
});

if (failures.length > 0) {
  console.error(`\n${failures.length} live smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll live smoke checks passed.');
}
