import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

// Stamped into every build so a deploy can be checked from the page itself
// (view source, or the console) without asking AJ what OBS is showing.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let commit = process.env.GITHUB_SHA || '';
try {
  commit ||= execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Not a git checkout; the version alone still identifies the release.
}
const buildId = `${version} ${commit.slice(0, 7)}`.trim();

export default defineConfig(({ mode }) => {
  const input = mode === 'stinger'
    ? resolve(__dirname, 'src/stinger/index.html')
    : mode === 'background'
    ? resolve(__dirname, 'src/background/index.html')
    : mode === 'sidebar'
    ? resolve(__dirname, 'src/sidebar/index.html')
    : mode === 'shade'
    ? resolve(__dirname, 'src/shade/index.html')
    : mode === 'epcot'
    ? resolve(__dirname, 'src/epcot/index.html')
    : resolve(__dirname, 'src/stinger/index.html'); // default

  return {
    plugins: [
      viteSingleFile(),
      {
        name: 'build-stamp',
        transformIndexHtml(html) {
          return html.replace(
            '</head>',
            `<meta name="build" content="${buildId}">\n<script>console.info('stream-animations ${buildId}')</script>\n</head>`
          );
        },
      },
      {
        name: 'move-index-html',
        closeBundle() {
          // Only scene builds produce dist/<scene>/src/<scene>/index.html; the
          // dev server (mode 'development') has nothing to move.
          if (['stinger', 'background', 'sidebar', 'shade', 'epcot'].includes(mode)) {
            const oldPath = resolve(__dirname, `dist/${mode}/src/${mode}/index.html`);
            const newPath = resolve(__dirname, `dist/${mode}/index.html`);
            const tempDir = resolve(__dirname, `dist/${mode}/src`);

            try {
              mkdirSync(dirname(newPath), { recursive: true });
              renameSync(oldPath, newPath);
              rmSync(tempDir, { recursive: true, force: true });
            } catch (error) {
              console.error('Error moving file:', error);
            }
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input,
      },
      outDir: mode ? `dist/${mode}` : 'dist',
      emptyOutDir: true,
    },
    base: './', // Use relative paths for file:// protocol compatibility
  };
});
