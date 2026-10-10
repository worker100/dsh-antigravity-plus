import { describe, expect, it, vi } from 'vitest'
import {
  ANTIGRAVITY_IMAGE_SETTINGS_NAMESPACE,
  Config as ImageConfig,
  apply as applyImage,
} from '../src/image.ts'
import {
  ANTIGRAVITY_SEARCH_SETTINGS_NAMESPACE,
  Config as SearchConfig,
  apply as applySearch,
  type AntigravitySearchSettings,
} from '../src/search.ts'
import {
  ANTIGRAVITY_VIDEO_SETTINGS_NAMESPACE,
  Config as VideoConfig,
  apply as applyVideo,
} from '../src/video.ts'
import { createStatusView } from '../src/status.ts'

function bench(kind: 'search' | 'image' | 'video') {
  const configure = vi.fn(() => vi.fn())
  const events = new Map<string, Set<() => void>>()
  const auth = {
    credential: vi.fn(),
    status: vi.fn(async () => createStatusView(false, {
      phase: 'idle',
      configured: false,
      projectAvailable: false,
    })),
    watchStatus: vi.fn(() => vi.fn()),
    dispose: vi.fn(),
  }
  const ctx = {
    fiber: {},
    ...(kind === 'search' ? { web: { registerSearchProvider: vi.fn(() => vi.fn()) } } : {}),
    ...(kind === 'image' ? { tools: { register: vi.fn(() => vi.fn()) }, attachments: {}, fs: {} } : {}),
    ...(kind === 'video' ? { tools: { register: vi.fn(() => vi.fn()) }, fs: {} } : {}),
    get: vi.fn(() => auth),
    inject: vi.fn((dependencies: readonly string[], callback: (injected: unknown) => unknown) => {
      if (dependencies.length === 1 && dependencies[0] === 'settings') {
        return callback({ settings: { configure }, effect: ctx.effect })
      }
      throw new Error(`unexpected injection: ${dependencies.join(',')}`)
    }),
    effect: vi.fn((setup: () => () => unknown) => setup()),
    on: vi.fn((event: string, listener: () => void) => {
      const listeners = events.get(event) ?? new Set()
      listeners.add(listener)
      events.set(event, listeners)
      return () => { listeners.delete(listener) }
    }),
  }
  return { ctx, auth, configure, events }
}

describe('DSH 0.1.7 Host Config forms', () => {
  it.each([
    { kind: 'search' as const, entryId: ANTIGRAVITY_SEARCH_SETTINGS_NAMESPACE, schema: SearchConfig, apply: applySearch },
    { kind: 'image' as const, entryId: ANTIGRAVITY_IMAGE_SETTINGS_NAMESPACE, schema: ImageConfig, apply: applyImage },
    { kind: 'video' as const, entryId: ANTIGRAVITY_VIDEO_SETTINGS_NAMESPACE, schema: VideoConfig, apply: applyVideo },
  ])('marks $kind controls as live and avoids duplicate generated pages', fixture => {
    const { ctx, configure } = bench(fixture.kind)
    const defaults = Object.values(fixture.schema.dict ?? {})

    expect(defaults.length).toBeGreaterThan(0)
    expect(defaults.every(field => field.meta.volatile === true)).toBe(true)

    fixture.apply(ctx as never)

    expect(configure).toHaveBeenCalledWith({ auto: false }, ctx.fiber)
  })

  it('reads live form values and rechecks the Search provider when a toggle changes', async () => {
    const { ctx, auth, events } = bench('search')
    auth.status.mockResolvedValue(createStatusView(true, {
      phase: 'success', configured: true, projectAvailable: true,
    }, undefined, undefined, {
      gate0: { outcome: 'passed', checkedAt: '2026-09-24T00:00:00.000Z' },
      capabilities: { search: { outcome: 'passed', checkedAt: '2026-09-24T00:00:00.000Z' } },
    }))
    const enabled = live(true)
    const model = live('initial-model')
    const maxResults = live(10)
    const config = { enabled, model, maxResults }

    applySearch(ctx as never, config)
    await new Promise<void>(resolve => setImmediate(resolve))

    const register = (ctx.web as { registerSearchProvider: ReturnType<typeof vi.fn> }).registerSearchProvider
    expect(auth.status).toHaveBeenCalledOnce()
    const provider = register.mock.calls[0]?.[0] as { options: { settings?: () => AntigravitySearchSettings } }
    expect(provider.options.settings?.()).toEqual({ enabled: true, model: 'initial-model', maxResults: 10 })

    model.set('updated-model')
    for (const listener of events.get('loader/volatile-update') ?? []) listener()
    expect(provider.options.settings?.()).toEqual({ enabled: true, model: 'updated-model', maxResults: 10 })

    enabled.set(false)
    for (const listener of events.get('loader/volatile-update') ?? []) listener()
    expect(register.mock.results[0]?.value).toHaveBeenCalledOnce()
  })
})

function live<T>(initial: T): { get(): T; set(value: T): void } {
  let value = initial
  return { get: () => value, set: next => { value = next } }
}
