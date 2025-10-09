import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Raízes da Fé",
        short_name: "Raízes da Fé",
        description: "Seu aplicativo de estudo bíblico.",
        theme_color: "#f5f5dc",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "app-icon.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
      },
      // --- PWA Configuration for Service Worker ---
      workbox: {
        // Force immediate activation of the new Service Worker
        skipWaiting: true,
        // Take control of all clients (tabs) immediately
        clientsClaim: true,
        // Define cache names for better organization and versioning
        cacheId: 'app-cache-v1', // Versioned cache name for runtime caches
        // Precache all essential files matching these patterns
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2,json}'],
        // Runtime caching strategies
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate', // For navigation requests (HTML)
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              plugins: [
                {
                  cacheWillUpdate: async ({ request, response }) => {
                    if (response && response.type === 'opaque') {
                      // Don't cache opaque responses, they can't be used.
                      return null;
                    }
                    return response;
                  },
                },
              ],
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)$/, // For images
            handler: 'NetworkFirst', // Use NetworkFirst as requested
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/, // For JS and CSS files
            handler: 'NetworkFirst', // Use NetworkFirst as requested
            options: {
              cacheName: 'static-resources-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i, // Google Fonts
            handler: 'CacheFirst', // Fonts are usually stable, CacheFirst is good here
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Year
              },
            },
          },
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i, // Cloudinary images
            handler: 'NetworkFirst', // Use NetworkFirst as requested
            options: {
              cacheName: 'cloudinary-image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.pathname.startsWith('/api/'), // All other same-origin requests not covered by precache
            handler: 'NetworkFirst',
            options: {
              cacheName: 'other-assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
              },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024, // Aumentado para 25 MB
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ['workbox-window'],
      output: {
        manualChunks: undefined,
      },
    },
  },
}));