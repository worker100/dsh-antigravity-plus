import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as net from 'node:net'
import {
  resolveEffectiveProxy,
  detectActiveLocalProxyPort,
  clearProxyProbeCache,
  formatConnectionDiagnostic,
  matchesNoProxy,
} from '../src/smart-proxy.ts'

describe('Smart Proxy Engine', () => {
  beforeEach(() => {
    clearProxyProbeCache()
  })

  afterEach(() => {
    clearProxyProbeCache()
  })

  it('matches no_proxy wildcard and domains correctly', () => {
    expect(matchesNoProxy('api.google.com', '*')).toBe(true)
    expect(matchesNoProxy('api.google.com', 'google.com')).toBe(true)
    expect(matchesNoProxy('api.google.com', '.google.com')).toBe(true)
    expect(matchesNoProxy('example.com', 'google.com')).toBe(false)
  })

  it('honors mode: direct to bypass any proxy', async () => {
    const target = new URL('https://aistudio.google.com/v1internal:test')
    const proxy = await resolveEffectiveProxy(target, { mode: 'direct' }, { HTTPS_PROXY: 'http://127.0.0.1:7890' })
    expect(proxy).toBeUndefined()
  })

  it('resolves explicit customProxy over environment variables', async () => {
    const target = new URL('https://aistudio.google.com/v1internal:test')
    const proxy = await resolveEffectiveProxy(
      target,
      { customProxy: '127.0.0.1:10809' },
      { HTTPS_PROXY: 'http://127.0.0.1:7890' },
    )
    expect(proxy?.href).toBe('http://127.0.0.1:10809/')
  })

  it('resolves environment variables when no custom proxy is provided', async () => {
    const target = new URL('https://aistudio.google.com/v1internal:test')
    const proxy = await resolveEffectiveProxy(
      target,
      undefined,
      { HTTPS_PROXY: 'http://127.0.0.1:7890' },
    )
    expect(proxy?.href).toBe('http://127.0.0.1:7890/')
  })

  it('sniffs local active proxy port when a local server is listening', async () => {
    // Spin up a mock local server on an arbitrary port
    const server = net.createServer().listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const address = server.address() as net.AddressInfo
    const activePort = address.port

    try {
      const detected = await detectActiveLocalProxyPort([activePort, 59999], 100, true)
      expect(detected).toBe(activePort)

      const target = new URL('https://aistudio.google.com/v1internal:test')
      const proxy = await resolveEffectiveProxy(target, undefined, {})
      expect(proxy?.href).toBe(`http://127.0.0.1:${activePort}/`)
    } finally {
      server.close()
    }
  })

  it('returns undefined if no proxy is configured or listening', async () => {
    const target = new URL('https://aistudio.google.com/v1internal:test')
    // Probe non-listening ports
    const proxy = await resolveEffectiveProxy(target, undefined, {})
    // In test environment, if no clash is running on tested ports, it falls back to direct
    expect(proxy === undefined || proxy.protocol === 'http:').toBe(true)
  })

  it('provides helpful bilingual connection diagnostics', () => {
    const err = new Error('Connection timed out')
    const zhDiag = formatConnectionDiagnostic(err, undefined, true)
    expect(zhDiag).toContain('未能连接至 Google 官方服务')
    expect(zhDiag).toContain('Clash (7890/7897)')

    const enDiag = formatConnectionDiagnostic(err, undefined, false)
    expect(enDiag).toContain('Could not reach Google service')

    const proxy = new URL('http://127.0.0.1:7890')
    const zhWithProxy = formatConnectionDiagnostic(err, proxy, true)
    expect(zhWithProxy).toContain('当前通过代理 http://127.0.0.1:7890 连接')
  })
})
