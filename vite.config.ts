import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      // Every supported browser takes woff2; dropping the woff fallback halves the font files.
      name: 'fontsource-woff2-only',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('@fontsource/') || !id.endsWith('.css')) return;
        return code.replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, '');
      },
    },
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // Registration happens through the virtual module import, so no inline script lands in index.html.
      injectRegister: false,
      injectManifest: {
        // App shell plus the pack manifest. Fonts are runtime-cached; pack files are never cached.
        globPatterns: ['**/*.{js,css,html}', 'favicon.svg', 'data/packs/manifest.json'],
        globIgnores: ['**/*.gz'],
      },
      manifest: {
        name: 'WaniStats',
        short_name: 'WaniStats',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAFAF7',
        theme_color: '#1F3B6E',
        description:
          'WaniKani stats: when you level up, how heavy your reviews are and when you finish.',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Timeline', url: '/timeline' },
          { name: 'Pace', url: '/pace' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Day and hour binning uses local time; pin it so tests are deterministic.
    env: { TZ: 'UTC' },
  },
});
