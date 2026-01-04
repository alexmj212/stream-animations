import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, mkdirSync, rmSync } from 'fs';

export default defineConfig(({ mode }) => {
  const input = mode === 'stinger'
    ? resolve(__dirname, 'src/stinger/index.html')
    : mode === 'background'
    ? resolve(__dirname, 'src/background/index.html')
    : resolve(__dirname, 'src/stinger/index.html'); // default

  return {
    plugins: [
      viteSingleFile(),
      {
        name: 'move-index-html',
        closeBundle() {
          if (mode) {
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
