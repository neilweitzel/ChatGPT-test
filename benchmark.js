import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iterations = 10000;
let start, end;
let dummy1, dummy2; // Scoped outside to prevent dead code elimination

// Inside hook performance simulation
start = performance.now();
const resolvedInsidePath = `file://${path.resolve(__dirname, '../index.html')}`;
for (let i = 0; i < iterations; i++) {
  const filePath = resolvedInsidePath;
  dummy1 = filePath;
}
end = performance.now();
const insideTime = end - start;
console.log(`Inside hook (resolving path every time): ${insideTime.toFixed(2)} ms for ${iterations} iterations`);

// Outside hook performance simulation
start = performance.now();
const filePath = `file://${path.resolve(__dirname, '../index.html')}`;
for (let i = 0; i < iterations; i++) {
  dummy2 = filePath;
}
end = performance.now();
const outsideTime = end - start;
console.log(`Outside hook (cached path): ${outsideTime.toFixed(2)} ms for ${iterations} iterations`);

// Performance budget check
// A budget of 50ms is chosen to provide a generous buffer for slower CI environments
// while remaining strict enough to catch major regressions like unintended synchronous I/O.
// Under typical conditions, these operations take < 5ms.
const BUDGET_MS = 50;

if (insideTime > BUDGET_MS || outsideTime > BUDGET_MS) {
  console.error(`Error: Performance budget exceeded! Limit is ${BUDGET_MS}ms.`);
  process.exit(1);
} else {
  console.log(`Performance is within the ${BUDGET_MS}ms budget.`);
}
