import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, type ResolvedConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { packageStaticContent } from './scripts/package-static-content.mjs';
let outputDirectory = 'dist';
export default defineConfig(async ({ command }) => {
  const developmentPublicDirectory = fileURLToPath(
    new URL('./outputs/dev-static', import.meta.url),
  );
  if (command === 'serve') {
    await packageStaticContent(developmentPublicDirectory);
    fs.cpSync(
      fileURLToPath(new URL('./public', import.meta.url)),
      developmentPublicDirectory,
      { recursive: true },
    );
  }
  return {
    publicDir: command === 'serve' ? developmentPublicDirectory : 'public',
    base: process.env.CISSP_BASE_PATH || '/',
    plugins: [
      react(),
      {
        name: 'package-course-content',
        configResolved(config: ResolvedConfig) {
          outputDirectory = config.build.outDir;
        },
        async closeBundle() {
          if (command === 'build') await packageStaticContent(outputDirectory);
        },
      },
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    css: { postcss: { plugins: [tailwindcss()] } },
    build: {
      rollupOptions: {
        input: {
          course: fileURLToPath(new URL('./index.html', import.meta.url)),
          pilot: fileURLToPath(new URL('./pilot/index.html', import.meta.url)),
        },
      },
    },
  };
});
