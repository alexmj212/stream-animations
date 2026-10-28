import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

// Stamped into every build so a deploy can be checked from the page itself
// (view source, or the console) without asking AJ what OBS is showing.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let commit = (process.env.GITHUB_SHA || '').slice(0, 7);
try {
  if (!commit) {
    commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().slice(0, 7);
    // Tracked files edited since HEAD: the build isn't that commit (the WSL
    // clone OBS loads from has had local edits). Untracked files don't count.
    try {
      execSync('git diff --quiet HEAD', { stdio: 'ignore' });
    } catch {
      commit += '-dirty';
    }
  }
} catch {
  // Not a git checkout; the version alone still identifies the release.
}
const buildId = `${version} ${commit}`.trim();

// Logs the build once at load. With ?debug=build (or 1/true/all, as in
// src/shared/debug.js) it also shows the build in
// the top-left corner, so a screenshot of OBS proves which build is running.
// Off by default; nothing runs per frame.
function buildStampScript(id) {
  return `console.info('stream-animations ${id}');
if (/^(1|true|all)$|(^|,)build(,|$)/.test(new URLSearchParams(location.search).get('debug') || '')) {
  addEventListener('DOMContentLoaded', () => {
    const el = document.createElement('div');
    el.textContent = 'build ${id}';
    el.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;padding:4px 8px;font:16px monospace;color:#fff;background:rgba(0,0,0,.7)';
    document.body.appendChild(el);
  });
}`;
}

export default defineConfig(({ mode }) => {
  const input = mode === 'stinger'
    ? resolve(__dirname, 'src/stinger/index.html')
    : mode === 'background'
    ? resolve(__dirname, 'src/background/index.html')
    : mode === 'sidebar'
    ? resolve(__dirname, 'src/sidebar/index.html')
    : mode === 'shade'
    ? resolve(__dirname, 'src/shade/index.html')
    : mode === 'notifications'
    ? resolve(__dirname, 'src/notifications/index.html')
    : mode === 'followers'
    ? resolve(__dirname, 'src/followers/index.html')
    : mode === 'epcot'
    ? resolve(__dirname, 'src/epcot/index.html')
    : mode === 'title'
    ? resolve(__dirname, 'src/title/index.html')
    : resolve(__dirname, 'src/stinger/index.html'); // default

  return {
    plugins: [
      viteSingleFile(),
      {
        name: 'build-stamp',
        transformIndexHtml(html) {
          return html.replace(
            '</head>',
            `<meta name="build" content="${buildId}">\n<script>${buildStampScript(buildId)}</script>\n</head>`
          );
        },
      },
      {
        name: 'move-index-html',
        closeBundle() {
          // Only scene builds produce dist/<scene>/src/<scene>/index.html; the
          // dev server (mode 'development') has nothing to move.
          if (['stinger', 'background', 'sidebar', 'shade', 'notifications', 'followers', 'epcot', 'title'].includes(mode)) {
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
