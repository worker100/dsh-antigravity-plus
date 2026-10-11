import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const socketState = vi.hoisted(() => ({
  unshifted: '',
  resumed: false,
  tlsWrappedAfterHandoff: false,
  request: '',
}))

vi.mock('node:net', async () => {
  const { EventEmitter: MockEventEmitter } = await vi.importActual<typeof import('node:events')>('node:events')
  class FakeProxySocket extends MockEventEmitter {
    write(data: string | Uint8Array): boolean {
      if (String(data).startsWith('CONNECT ')) {
        queueMicrotask(() => this.emit('data', Buffer.from('HTTP/1.1 200 Connection established\r\n\r\nTLS_EARLY', 'latin1')))
      }
      return true
    }

    unshift(data: Uint8Array): void {
      socketState.unshifted = Buffer.from(data).toString('latin1')
    }

    resume(): this {
      socketState.resumed = true
      return this
    }

    destroy(): this { return this }
  }

  return {
    connect: vi.fn(() => {
      const socket = new FakeProxySocket()
      queueMicrotask(() => socket.emit('connect'))
      return socket
    }),
  }
})

vi.mock('node:tls', async () => {
  const { EventEmitter: MockEventEmitter } = await vi.importActual<typeof import('node:events')>('node:events')
  class FakeTlsSocket extends MockEventEmitter {
    write(data: string | Uint8Array): boolean {
      socketState.request += Buffer.from(data).toString('latin1')
      queueMicrotask(() => {
        this.emit('data', Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK', 'latin1'))
        this.emit('end')
      })
      return true
    }

    destroy(): this { return this }
  }

  return {
    connect: vi.fn(({ socket: _socket }: { socket: unknown }) => {
      socketState.tlsWrappedAfterHandoff = socketState.unshifted === 'TLS_EARLY' && socketState.resumed
      const tlsSocket = new FakeTlsSocket()
      queueMicrotask(() => tlsSocket.emit('secureConnect'))
      return tlsSocket
    }),
  }
})

import { clearProxyProbeCache, createSmartFetch } from '../src/smart-proxy.ts'

describe('smart fetch proxy tunnel', () => {
  beforeEach(() => {
    socketState.unshifted = ''
    socketState.resumed = false
    socketState.tlsWrappedAfterHandoff = false
    socketState.request = ''
    vi.stubEnv('HTTPS_PROXY', 'http://127.0.0.1:8899')
    vi.stubEnv('NO_PROXY', '')
    clearProxyProbeCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    clearProxyProbeCache()
  })

  it('restores CONNECT remainder and resumes the socket before TLS wraps it', async () => {
    const fallbackFetch = vi.fn<typeof fetch>()
    const response = await createSmartFetch(fallbackFetch)('https://example.test/probe')

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('OK')
    expect(socketState.tlsWrappedAfterHandoff).toBe(true)
    expect(socketState.request).toContain('GET /probe HTTP/1.1\r\n')
    expect(fallbackFetch).not.toHaveBeenCalled()
  })
})
