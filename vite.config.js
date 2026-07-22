import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT
const sentryRelease = process.env.SENTRY_RELEASE

export default defineConfig({
  // sourcemap: true — 베타 단계 디버깅 편의 우선. Sentry stack trace에서
  // minified $g 대신 실제 함수명/파일/라인이 보이도록.
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '나매크',
        short_name: '나매크',
        description: '자기주도 학습·진로성장 관리 시스템',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
    // Sentry 환경변수 4종이 모두 있을 때만 활성화. 로컬/PR 빌드에선 조용히 skip.
    sentryAuthToken && sentryOrg && sentryProject &&
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        release: sentryRelease ? { name: sentryRelease } : undefined,
      }),
  ].filter(Boolean),
  base: '/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
})
