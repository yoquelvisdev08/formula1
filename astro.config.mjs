import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://yoquelvisdev08.github.io',
  base: '/formula1',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
