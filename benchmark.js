const path = require('path');
const { performance } = require('perf_hooks');

const iterations = 1000000;

// Baseline
const startBaseline = performance.now();
for (let i = 0; i < iterations; i++) {
  `file://${path.resolve(__dirname, '../index.html')}`;
}
const endBaseline = performance.now();
console.log(`Baseline (resolve path every time): ${endBaseline - startBaseline} ms`);

// Optimized
const startOptimized = performance.now();
const filePath = `file://${path.resolve(__dirname, '../index.html')}`;
for (let i = 0; i < iterations; i++) {
  filePath;
}
const endOptimized = performance.now();
console.log(`Optimized (cached path): ${endOptimized - startOptimized} ms`);
