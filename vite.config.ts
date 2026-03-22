import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Rolldown/Vite 8 rejects @mediapipe/tasks-vision "exports" shape — 번들 엔트리로 직접 연결
// https://github.com/vitejs/vite/issues (mixed exports keys)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mediapipe/tasks-vision': path.resolve(
        __dirname,
        'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
      ),
    },
  },
})
