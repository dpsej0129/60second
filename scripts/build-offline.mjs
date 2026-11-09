import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// No remote resources: the whole game can run from a downloaded local file.
let html = await readFile('dist/index.html', 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const sheet = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!script || !sheet) throw new Error('Expected one Vite entry and stylesheet');
const js = await readFile(resolve('dist', script[1].replace(/^\//, '')), 'utf8');
const css = await readFile(resolve('dist', sheet[1].replace(/^\//, '')), 'utf8');
html = html.replace(script[0], '').replace(sheet[0], () => `<style>${css}</style>`);
html = html.replace('</body>', () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script></body>`);
html = html.replace(/^[ \t]+$/gm, '');
await writeFile('dist/60second.html', html);
// A stable fallback URL shared by Actions and branch-based Pages deployments.
await mkdir('dist/downloads', { recursive: true });
await writeFile('dist/downloads/60second.html', html);
console.log('Created dist/60second.html — open directly in a browser, no server needed.');
