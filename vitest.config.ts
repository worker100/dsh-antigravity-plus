import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      'dsh-antigravity-plus/wire-identity': resolve(projectRoot, 'src/wire-identity.ts'),
      'dsh-antigravity-plus/invariant': resolve(projectRoot, 'src/invariant.ts'),
      'dsh-antigravity-plus/project-context': resolve(projectRoot, 'src/project-context.ts'),
      'dsh-antigravity-plus': resolve(projectRoot, 'src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    pool: 'forks',
    restoreMocks: true,
  },
})
