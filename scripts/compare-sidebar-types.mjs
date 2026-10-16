import { readFileSync } from 'node:fs';

function diagnostics(file) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('> tsc')) throw new Error('TypeScript check did not run');
  if (/command not found|Cannot find module|FATAL ERROR/.test(text) && !text.includes('error TS')) throw new Error('TypeScript could not initialize');
  const results = new Map();
  for (const line of text.split('\n')) {
    const match = /^(.*?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line);
    if (match) { // Drizzle's expanded object types may reorder their properties when new
      // modules change traversal order. Compare diagnostic categories by file,
      // retaining the property name for missing-property diagnostics.
      const property = /^Property ('[^']+')/.exec(match[3])?.[1] || '';
      const key = `${match[1]}: ${match[2]}: ${property}`; results.set(key, (results.get(key) || 0) + 1); }
  }
  return results;
}
const before = diagnostics(process.argv[2]);
const after = diagnostics(process.argv[3]);
const added = [...after].filter(([message, count]) => count > (before.get(message) || 0));
console.log(`Pre-existing TypeScript errors: ${[...before.values()].reduce((a, b) => a + b, 0)}; current errors: ${[...after.values()].reduce((a, b) => a + b, 0)}`);
if (added.length) { console.error('New TypeScript errors:', added); process.exitCode = 1; }
else console.log('No new TypeScript errors.');
