import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('================================================================');
  console.log('  JIRA AI DISTRIBUTED PLATFORM - OPAQUE-BOX E2E TEST SUITE     ');
  console.log('================================================================');
  console.log(`Node.js Runtime : ${process.version}`);
  console.log('Execution Mode  : STANDALONE MOCK CLUSTER (does not connect to Docker/Kubernetes)');
  console.log(`Timestamp       : ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  const suiteFiles = [
    'suites/tier1-features.test.ts',
    'suites/tier2-boundaries.test.ts',
    'suites/tier3-pairwise.test.ts',
    'suites/tier4-scenarios.test.ts',
  ];

  const args = [
    '--experimental-strip-types',
    '--test',
    ...suiteFiles,
  ];

  const startTime = Date.now();
  const child = spawn(process.execPath, args, {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n================================================================');
    if (code === 0) {
      console.log(`  RESULT: ALL E2E TEST SUITES PASSED [${duration}s]           `);
      console.log('  - Tier 1: Core Feature Coverage (PASS)');
      console.log('  - Tier 2: Boundary & Corner Cases (PASS)');
      console.log('  - Tier 3: Pairwise Combinations (PASS)');
      console.log('  - Tier 4: Real-World Scenarios (PASS)');
      console.log('================================================================');
    } else {
      console.error(`  RESULT: E2E TEST SUITE FAILED with exit code ${code} [${duration}s]`);
      console.log('================================================================');
    }
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
