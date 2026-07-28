import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // .worktrees berisi checkout git lama; tanpa exclude vitest ikut
  // menjalankan salinan test usang di dalamnya.
  test: { environment: 'node', exclude: [...configDefaults.exclude, '.worktrees/**'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
