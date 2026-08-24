const { spawnSync } = require('node:child_process');
const { globSync } = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '.test-out', 'test');
const files = globSync('**/*.test.js', { cwd: dir }).map((file) =>
  path.join(dir, file),
);

if (files.length === 0) {
  console.error('No compiled tests found. Run tsc -p test/tsconfig.json first.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  windowsVerbatimArguments: false,
});

process.exit(result.status === null ? 1 : result.status);
