/** Smart Proxy Engine: Local proxy auto-detection, port sniffing, and fallback resolution. */

import { Buffer } from 'node:buffer'
import * as net from 'node:net'
import * as tls from 'node:tls'
import { URL } from 'node:url'
import { PrivateTransportError } from './private-transport-error.ts'

export interface SmartProxyConfig {
  readonly mode?: 'auto' | 'direct' | 'manual'
  readonly customProxy?: string
}

export interface EffectiveProxyDetails {
  readonly proxy?: URL
  readonly source: 'bypass' | 'environment' | 'local-detected' | 'direct'
}

export const COMMON_LOCAL_PROXY_PORTS = Object.freeze([
  7890,  // Clash / Clash for Windows / Clash Verge default
  7897,  // Mihomo Party / Clash Verge Rev new default
  10809, // v2rayN / Xray HTTP inbound default
  6152,  // Surge HTTP default
  2080,  // Sing-box HTTP default
])

let cachedDetectedPort: number | null | undefined = undefined
let cachedDetectionTimestamp = 0
const PROBE_CACHE_TTL_MS = 60_000

/** Quick TCP probe to check if a local port is actively listening. */
export function probeLocalPort(port: number, timeoutMs = 120): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: boolean) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    try {
      const connectFn = (net as unknown as { createConnection?: typeof net.createConnection; connect?: typeof net.connect }).createConnection
        ?? (net as unknown as { connect?: typeof net.connect }).connect
      if (typeof connectFn !== 'function') {
        finish(false)
        return
      }

      const socket = connectFn({ host: '127.0.0.1', port })
      const timer = setTimeout(() => {
        try { socket.destroy() } catch {}
        finish(false)
      }, timeoutMs)

      socket.once('connect', () => {
        clearTimeout(timer)
        try { socket.destroy() } catch {}
        finish(true)
      })

      socket.once('error', () => {
        clearTimeout(timer)
        try { socket.destroy() } catch {}
        finish(false)
      })
    } catch {
      finish(false)
    }
  })
}

/** Sniff known local proxy ports and return the first active one, if any. */
export async function detectActiveLocalProxyPort(
  ports: readonly number[] = COMMON_LOCAL_PROXY_PORTS,
  timeoutMs = 120,
  forceRefresh = false,
): Promise<number | undefined> {
  const now = Date.now()
  if (!forceRefresh && cachedDetectedPort !== undefined && (now - cachedDetectionTimestamp) < PROBE_CACHE_TTL_MS) {
    return cachedDetectedPort === null ? undefined : cachedDetectedPort
  }

  try {
    for (const port of ports) {
      const alive = await probeLocalPort(port, timeoutMs)
      if (alive) {
        cachedDetectedPort = port
        cachedDetectionTimestamp = now
        return port
      }
    }
  } catch {
    // Fail-safe against mock or environment exceptions
  }

  cachedDetectedPort = null
  cachedDetectionTimestamp = now
  return undefined
}

/** Clear the probe cache (useful in tests or when network changes). */
export function clearProxyProbeCache(): void {
  cachedDetectedPort = undefined
  cachedDetectionTimestamp = 0
}

/** Resolve the effective HTTPS proxy URL with smart fallback and sniffing. */
export async function resolveEffectiveProxy(
  url: URL,
  config?: SmartProxyConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<URL | undefined> {
  const noProxy = env.NO_PROXY ?? env.no_proxy ?? ''
  if (matchesNoProxy(url.hostname, noProxy)) {
    return undefined
  }

  // 1. Explicit Direct mode overrides everything
  if (config?.mode === 'direct') {
    return undefined
  }

  // 2. Custom manual proxy
  if (config?.mode === 'manual' && typeof config.customProxy === 'string' && config.customProxy.trim().length > 0) {
    return parseAndValidateProxyUrl(config.customProxy.trim())
  }

  // 3. User configured custom proxy URL (if provided without explicit mode)
  if (typeof config?.customProxy === 'string' && config.customProxy.trim().length > 0) {
    return parseAndValidateProxyUrl(config.customProxy.trim())
  }

  // 4. Standard environment variables (HTTPS_PROXY / https_proxy / ALL_PROXY / all_proxy)
  const envRaw = env.HTTPS_PROXY ?? env.https_proxy ?? env.ALL_PROXY ?? env.all_proxy
  if (typeof envRaw === 'string' && envRaw.trim().length > 0) {
    return parseAndValidateProxyUrl(envRaw.trim())
  }

  // 5. Smart auto-detection of local proxy ports (Clash 7890/7897, v2rayN 10809, etc.)
  return (await inspectEffectiveProxy(url, env)).proxy
}

/** Report the same environment/auto route used by requests, without exposing proxy credentials. */
export async function inspectEffectiveProxy(
  url: URL,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EffectiveProxyDetails> {
  const noProxy = env.NO_PROXY ?? env.no_proxy ?? ''
  if (matchesNoProxy(url.hostname, noProxy)) return { source: 'bypass' }

  const envRaw = env.HTTPS_PROXY ?? env.https_proxy ?? env.ALL_PROXY ?? env.all_proxy
  if (typeof envRaw === 'string' && envRaw.trim().length > 0) {
    return { proxy: parseAndValidateProxyUrl(envRaw.trim()), source: 'environment' }
  }

  const detectedPort = await detectActiveLocalProxyPort()
  if (detectedPort !== undefined) {
    return { proxy: new URL(`http://127.0.0.1:${detectedPort}`), source: 'local-detected' }
  }

  return { source: 'direct' }
}

/** Synchronous fallback resolution using only env and explicit config (no async sniffing). */
export function resolveEffectiveProxySync(
  url: URL,
  config?: SmartProxyConfig,
  env: NodeJS.ProcessEnv = process.env,
): URL | undefined {
  const noProxy = env.NO_PROXY ?? env.no_proxy ?? ''
  if (matchesNoProxy(url.hostname, noProxy)) {
    return undefined
  }

  if (config?.mode === 'direct') {
    return undefined
  }

  if (config?.mode === 'manual' && typeof config.customProxy === 'string' && config.customProxy.trim().length > 0) {
    return parseAndValidateProxyUrl(config.customProxy.trim())
  }

  if (typeof config?.customProxy === 'string' && config.customProxy.trim().length > 0) {
    return parseAndValidateProxyUrl(config.customProxy.trim())
  }

  const envRaw = env.HTTPS_PROXY ?? env.https_proxy ?? env.ALL_PROXY ?? env.all_proxy
  if (typeof envRaw === 'string' && envRaw.trim().length > 0) {
    return parseAndValidateProxyUrl(envRaw.trim())
  }

  // If a previously sniffed port is cached, use it synchronously
  if (cachedDetectedPort !== undefined && cachedDetectedPort !== null) {
    return new URL(`http://127.0.0.1:${cachedDetectedPort}`)
  }

  return undefined
}

function parseAndValidateProxyUrl(raw: string): URL {
  let normalized = raw
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    normalized = `http://${raw}`
  }
  try {
    const proxy = new URL(normalized)
    if (proxy.protocol !== 'http:') {
      throw new PrivateTransportError('offline', 'The configured HTTPS proxy protocol is unsupported (must be HTTP)', { accepted: false })
    }
    return proxy
  } catch (error) {
    if (error instanceof PrivateTransportError) throw error
    throw new PrivateTransportError('offline', 'The configured HTTPS proxy URL is invalid', { accepted: false })
  }
}

export function matchesNoProxy(hostname: string, value: string): boolean {
  if (!value) return false
  const host = hostname.toLowerCase()
  return value.split(',').map(item => item.trim().toLowerCase()).some(item => (
    item === '*'
    || (item.startsWith('.') ? host.endsWith(item) : item.length > 0 && (host === item || host.endsWith(`.${item}`)))
  ))
}

/** Human-friendly bilingual diagnostic guidance when a connection error occurs. */
export function formatConnectionDiagnostic(
  originalError: Error | string,
  proxyUrl?: URL,
  isZh = true,
): string {
  const message = typeof originalError === 'string' ? originalError : originalError.message
  if (proxyUrl) {
    return isZh
      ? `${message}（当前通过代理 ${proxyUrl.origin} 连接，请检查代理软件运行状态与节点可用性）`
      : `${message} (Connected through proxy ${proxyUrl.origin}; please check proxy client status and node reachability)`
  }

  return isZh
    ? `${message}（未能连接至 Google 官方服务。如您在中国大陆，请确认已启动 Clash (7890/7897) 或 v2rayN (10809) 等代理，或在插件设置中指定代理端口）`
    : `${message} (Could not reach Google service. If you are in a region requiring proxy access, ensure your proxy is active or configure a proxy in settings)`
}

/** Creates a proxied fetch implementation that tunnels HTTPS requests via local/remote HTTP proxies. */
export function createSmartFetch(fallbackFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return async function smartFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const targetUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (targetUrl.protocol !== 'https:') {
      return fallbackFetch(input, init)
    }

    const proxy = await resolveEffectiveProxy(targetUrl)
    if (!proxy) {
      return fallbackFetch(input, init)
    }

    return executeHttpsOverProxy(proxy, targetUrl, init)
  }
}

async function executeHttpsOverProxy(proxy: URL, targetUrl: URL, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET'
  const headers = new Headers(init?.headers)
  if (!headers.has('Host')) {
    headers.set('Host', targetUrl.host)
  }
  if (!headers.has('Connection')) {
    headers.set('Connection', 'close')
  }

  let bodyBuffer: Buffer | undefined
  if (init?.body) {
    if (typeof init.body === 'string') {
      bodyBuffer = Buffer.from(init.body, 'utf8')
    } else if (init.body instanceof Uint8Array) {
      bodyBuffer = Buffer.from(init.body)
    } else {
      bodyBuffer = Buffer.from(await new Response(init.body).arrayBuffer())
    }
    if (!headers.has('Content-Length')) {
      headers.set('Content-Length', String(bodyBuffer.byteLength))
    }
  }

  return new Promise<Response>((resolve, reject) => {
    let settled = false
    const timeoutMs = 15000
    const proxySocket = net.connect({
      host: proxy.hostname,
      port: Number(proxy.port || 8080),
    })

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      proxySocket.destroy()
      reject(new Error(formatConnectionDiagnostic(err, proxy)))
    }

    const timer = setTimeout(() => fail(new Error('HTTPS connection via proxy timed out')), timeoutMs)

    proxySocket.once('error', (err) => {
      clearTimeout(timer)
      fail(err)
    })

    proxySocket.once('connect', () => {
      const connectReq = `CONNECT ${targetUrl.hostname}:${targetUrl.port || 443} HTTP/1.1\r\nHost: ${targetUrl.hostname}:${targetUrl.port || 443}\r\n\r\n`
      proxySocket.write(connectReq)

      let headReceived = ''
      const onTunnelData = (chunk: Buffer) => {
        headReceived += chunk.toString('latin1')
        const delim = headReceived.indexOf('\r\n\r\n')
        if (delim !== -1) {
          proxySocket.off('data', onTunnelData)
          const firstLine = headReceived.slice(0, headReceived.indexOf('\r\n'))
          if (!/^HTTP\/1\.[01]\s+2\d\d/i.test(firstLine)) {
            clearTimeout(timer)
            fail(new Error(`Proxy tunnel rejected connection: ${firstLine}`))
            return
          }

          const remainder = chunk.subarray(Buffer.byteLength(headReceived.slice(0, delim + 4), 'latin1'))
          if (remainder.length > 0) {
            proxySocket.unshift(remainder)
          }
          proxySocket.resume()
          const tlsSocket = tls.connect({
            socket: proxySocket,
            servername: targetUrl.hostname,
          })

          tlsSocket.once('error', (tlsErr: Error) => {
            clearTimeout(timer)
            fail(tlsErr)
          })

          tlsSocket.once('secureConnect', () => {
            clearTimeout(timer)
            let requestString = `${method} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n`
            headers.forEach((val, key) => {
              requestString += `${key}: ${val}\r\n`
            })
            requestString += '\r\n'

            tlsSocket.write(requestString)
            if (bodyBuffer && bodyBuffer.length > 0) {
              tlsSocket.write(bodyBuffer)
            }

            const responseChunks: Buffer[] = []
            tlsSocket.on('data', (d: Buffer) => responseChunks.push(d))
            tlsSocket.once('end', () => {
              if (settled) return
              settled = true
              const fullBuffer = Buffer.concat(responseChunks)
              const rawString = fullBuffer.toString('latin1')
              const resHeaderEnd = rawString.indexOf('\r\n\r\n')
              if (resHeaderEnd === -1) {
                reject(new Error('Incomplete HTTP response from target'))
                return
              }
              const headerLines = rawString.slice(0, resHeaderEnd).split('\r\n')
              const statusLine = headerLines.shift() ?? ''
              const statusMatch = /^HTTP\/1\.[01]\s+(\d{3})(?:\s+(.*))?$/i.exec(statusLine)
              const status = statusMatch ? Number(statusMatch[1]) : 200
              const statusText = statusMatch?.[2] ?? 'OK'
              const resHeaders = new Headers()
              for (const line of headerLines) {
                const idx = line.indexOf(':')
                if (idx > 0) {
                  resHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
                }
              }
              const bodyBytes = fullBuffer.subarray(Buffer.byteLength(rawString.slice(0, resHeaderEnd + 4), 'latin1'))
              resolve(new Response(bodyBytes, { status, statusText, headers: resHeaders }))
            })
          })

        }
      }

      proxySocket.on('data', onTunnelData)
    })
  })
}

