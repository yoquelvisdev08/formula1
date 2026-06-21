import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/** GitHub Pages project sites need a subpath; Vercel and local dev use root. */
const base = process.env.ASTRO_BASE ?? '/';
const site = process.env.ASTRO_SITE;

export default defineConfig({
  ...(site ? { site } : {}),
  base,
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
