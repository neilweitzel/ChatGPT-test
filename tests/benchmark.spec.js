import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = util.promisify(exec);

test.describe('benchmark.js', () => {
  test('executes benchmark script successfully and logs results', async () => {
    // Increase timeout since benchmark might take a bit
    test.setTimeout(30000);

    const benchmarkPath = path.resolve(__dirname, '../benchmark.js');

    // Run the benchmark script
    const { stdout, stderr } = await execPromise(`node "${benchmarkPath}"`);

    // Verify there are no errors in stderr
    expect(stderr).toBe('');

    // Verify stdout contains expected baseline and optimized output
    expect(stdout).toContain('Inside hook (resolving path every time):');
    expect(stdout).toContain('Outside hook (cached path):');
    expect(stdout).toContain('ms');
  });
});
