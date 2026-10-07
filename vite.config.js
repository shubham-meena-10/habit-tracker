import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// export default defineConfig({
//   // Hosting under a sub-path (e.g. GitHub Pages)? Uncomment and use your repo name.
//   // The manifest scope and start URL follow this automatically.
//   // base: '/habit-tracker/',
//   plugins: [
//     react(),
//     VitePWA({
//       registerType: 'prompt',
//       includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
//       manifest: {
//         name: 'Habit Tracker',
//         short_name: 'Habits',
//         description: 'Personal habit, goal and progress tracker',
//         lang: 'en-IN',
//         theme_color: '#0f766e',
//         background_color: '#f6f7f9',
//         display: 'standalone',
//         orientation: 'portrait',
//         categories: ['health', 'productivity', 'lifestyle'],
//         icons: [
//           { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
//           { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
//           { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
//           { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
//         ],
//         shortcuts: [
//           { name: 'Day check-in', short_name: 'Check-in', url: './#/checkin' },
//           { name: 'Schedule', short_name: 'Schedule', url: './#/schedule' },
//         ],
//       },
//       workbox: {
//         globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
//         cleanupOutdatedCaches: true,
//         importScripts: ['sw-notify.js'],
//       },
//     }),
//   ],
// });

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
      registerType: "prompt",

      includeAssets: [
        "favicon.ico",
        "icon.svg",
        "apple-touch-icon-180x180.png",
      ],

      manifest: {
        name: "Habit Tracker",
        short_name: "Habits",
        description: "Personal habit, goal and progress tracker",
        lang: "en-IN",
        theme_color: "#0f766e",
        background_color: "#f6f7f9",
        display: "standalone",
        orientation: "portrait",
        categories: ["health", "productivity", "lifestyle"],

        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],

        shortcuts: [
          {
            name: "Day check-in",
            short_name: "Check-in",
            url: "./#/checkin",
          },
          {
            name: "Schedule",
            short_name: "Schedule",
            url: "./#/schedule",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        importScripts: ["sw-notify.js"],
      },
    }),
  ],
});