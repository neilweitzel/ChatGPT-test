const path = require('path');

const iterations = 10000;
let start, end;
let dummy;

// Inside hook performance simulation
start = performance.now();
for (let i = 0; i < iterations; i++) {
  dummy = `file://${path.resolve(__dirname, '../index.html')}`;
}
end = performance.now();
console.log(`Inside hook (resolving path every time): ${(end - start).toFixed(2)} ms for ${iterations} iterations`);

// Outside hook performance simulation
start = performance.now();
const filePath = `file://${path.resolve(__dirname, '../index.html')}`;
for (let i = 0; i < iterations; i++) {
  dummy = filePath;
}
end = performance.now();
console.log(`Outside hook (cached path): ${(end - start).toFixed(2)} ms for ${iterations} iterations`);
