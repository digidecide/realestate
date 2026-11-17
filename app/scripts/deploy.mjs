// Copies the built app from app/dist into the repository root for GitHub Pages.
// Only index.html, 404.html and the assets/ folder are replaced; CNAME,
// enquiries/ and the source folders are left alone.
import { cpSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dist = resolve('dist');
const root = resolve('..');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Run npm run build first.');
rmSync(resolve(root, 'assets'), { recursive: true, force: true });
cpSync(resolve(dist, 'assets'), resolve(root, 'assets'), { recursive: true });
copyFileSync(resolve(dist, 'index.html'), resolve(root, 'index.html'));
copyFileSync(resolve(dist, 'index.html'), resolve(root, '404.html'));
for (const f of ['favicon.svg']) if (existsSync(resolve(dist, f))) copyFileSync(resolve(dist, f), resolve(root, f));
console.log('Deployed build to repository root.');
