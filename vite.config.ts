import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite';

const iconSizes = [72, 96, 128, 144, 152, 180, 192, 384, 512] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const remote = env.VITE_SUPABASE_URL?.trim();
  const proxy = remote
    ? {
        '/auth': { target: remote, changeOrigin: true },
        '/rest': { target: remote, changeOrigin: true },
        '/storage': { target: remote, changeOrigin: true },
      }
    : undefined;

  return {
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'splash/*.png'],
      manifest: {
        id: '/',
        name: 'FieldNotes',
        short_name: 'FieldNotes',
        description: 'Notas de campo neste aparelho, mesmo sem rede.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#efece6',
        theme_color: '#efece6',
        categories: ['productivity', 'utilities'],
        icons: [
          ...iconSizes.map((size) => ({
            src: `/icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any' as const,
          })),
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable' as const,
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable' as const,
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // No telemóvel a página está noutro endereço. O pedido de login segue por aqui
    // e o Vite encaminha para o servidor, senão o Safari recusa a resposta.
    host: true,
    proxy,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // O helper de CommonJS do Vite ia parar no chunk da aplicação e o Ionic
    // importava esse chunk de volta. Isso quebrava o boot em produção.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  };
});
