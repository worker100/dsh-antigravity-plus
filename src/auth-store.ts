/** Owner-only, versioned, multi-account refresh-token persistence. */

import { randomUUID } from 'node:crypto'
import { chmod, mkdir, open, readFile, rename, lstat, unlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isBoundedSafeText } from './safe-text.ts'

export const AUTH_RECORD_VERSION = 1 as const
export const MULTI_ACCOUNT_VERSION = 2 as const

const AUTH_STORE_LOCK_NAME = '.auth.lock'
const AUTH_STORE_LOCK_TIMEOUT_MS = 10_000
const AUTH_STORE_LOCK_STALE_MS = 30_000
const AUTH_STORE_LOCK_RETRY_MS = 10

export interface AuthRecordDraft {
  readonly refreshToken: string
  readonly projectId: string
  readonly email?: string
  /** Keep the same lineage for a refresh; a new login omits it to fence older work. */
  readonly lineage?: string
}

export interface AntigravityAuthRecord {
  readonly version: typeof AUTH_RECORD_VERSION
  readonly refreshToken: string
  readonly projectId: string
  readonly email?: string
  readonly revision: number
  readonly updatedAt: string
  /** A per-login lineage fence; absent only on records written by older versions. */
  readonly lineage?: string
}

export interface StoredAccountItem {
  readonly id: string
  readonly email?: string | undefined
  readonly refreshToken: string
  readonly projectId: string
  readonly addedAt: string
  readonly lineage?: string | undefined
}

export interface MultiAccountStoreData {
  readonly version: typeof MULTI_ACCOUNT_VERSION
  activeAccountId?: string | undefined
  accounts: StoredAccountItem[]
  revision: number
  updatedAt: string
}

export interface AccountSummary {
  readonly id: string
  readonly email?: string | undefined
  readonly projectId: string
  readonly addedAt: string
  readonly active: boolean
}

export interface AuthStoreOptions {
  readonly now?: () => number
  /** Override process.platform only for deterministic cross-platform tests. */
  readonly platform?: NodeJS.Platform
  /** Import the legacy local seed only for the live default store bootstrap. */
  readonly importSeed?: boolean
}

export interface AntigravityAuthStore {
  read(): Promise<AntigravityAuthRecord | undefined>
  commit(draft: AuthRecordDraft): Promise<AntigravityAuthRecord>
  compareAndCommit(
    expectedRevision: number,
    draft: AuthRecordDraft,
    expectedLineage?: string,
  ): Promise<AntigravityAuthRecord | undefined>
  /** Clear only when the observed record is still the same account lineage. */
  clearIfCurrent(expectedRevision: number, expectedLineage?: string): Promise<boolean>
  clear(): Promise<void>
  listAccounts(): Promise<{ activeAccountId?: string | undefined; accounts: AccountSummary[] }>
  switchAccount(accountId: string): Promise<AntigravityAuthRecord | undefined>
  removeAccount(accountId: string): Promise<boolean>
}

export type AuthStoreErrorCode =
  | 'AUTH_STORE_CORRUPT'
  | 'AUTH_STORE_UNSUPPORTED_VERSION'
  | 'AUTH_STORE_UNSAFE_PERMISSIONS'
  | 'AUTH_STORE_CONFLICT'
  | 'AUTH_STORE_IO'

export class AuthStoreError extends Error {
  readonly code: AuthStoreErrorCode

  constructor(code: AuthStoreErrorCode, message: string) {
    super(message)
    this.name = 'AuthStoreError'
    this.code = code
  }
}

/** Resolve the plugin-owned default path without reading it. */
export function defaultAuthStorePath(
  env: NodeJS.ProcessEnv = process.env,
  home = env.HOME,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    const windowsDataHome = env.LOCALAPPDATA ?? env.APPDATA
    const base = typeof windowsDataHome === 'string' && windowsDataHome.length > 0
      ? windowsDataHome
      : env.USERPROFILE ?? home ?? ''
    const plusPath = join(base, 'dsh-antigravity-plus', 'auth.json')
    if (existsSync(plusPath)) return plusPath
    const legacyPath = join(base, 'dsh-antigravity-auth', 'auth.json')
    if (existsSync(legacyPath)) return legacyPath
    return plusPath
  }
  const dataHome = env.XDG_DATA_HOME
  const base = typeof dataHome === 'string' && dataHome.length > 0
    ? dataHome
    : join(home ?? '', '.local', 'share')
  const plusPath = join(base, 'dsh-antigravity-plus', 'auth.json')
  if (existsSync(plusPath)) return plusPath
  const legacyPath = join(base, 'dsh-antigravity-auth', 'auth.json')
  if (existsSync(legacyPath)) return legacyPath
  return plusPath
}

/** Try importing seed account from existing system locations if store is empty. */
function tryFindSeedAccount(): { email: string; refreshToken: string; projectId: string } | undefined {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    join(home, '.pi', 'agent', 'antigravity-accounts.json'),
    join(home, '.dsh', 'agy-accounts', 'backup-before-migration', 'antigravity-accounts.json'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const raw = JSON.parse(readFileSync(candidate, 'utf8'))
        if (raw && Array.isArray(raw.accounts) && raw.accounts.length > 0) {
          const first = raw.accounts[0]
          const cred = first.credential || {}
          const token = cred.refresh || first.refreshToken
          const proj = cred.projectId || first.projectId || 'aicode-consumers'
          const mail = first.email || cred.email || 'primary@google.account'
          if (typeof token === 'string' && token.length > 10) {
            return { email: mail, refreshToken: token, projectId: proj }
          }
        }
      } catch {}
    }
  }
  return undefined
}

function toAuthRecord(
  item: StoredAccountItem,
  revision: number,
  updatedAt: string,
): AntigravityAuthRecord {
  return {
    version: AUTH_RECORD_VERSION,
    refreshToken: item.refreshToken,
    projectId: item.projectId,
    revision,
    updatedAt,
    ...(item.email !== undefined ? { email: item.email } : {}),
    ...(item.lineage !== undefined ? { lineage: item.lineage } : {}),
  }
}

function canonicalAccountEmail(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.includes('@') ? normalized : undefined
}

/** Create one store whose public API never exposes an access token field. */
export function createAuthStore(path: string, options: AuthStoreOptions = {}): AntigravityAuthStore {
  const now = options.now ?? (() => Date.now())
  const platform = options.platform ?? process.platform
  const enqueue = createMutationQueue()

  async function loadData(): Promise<MultiAccountStoreData> {
    const raw = await readRawStorage(path, platform)
    if (raw) return raw
    // Only the real default store may import the one-time local migration seed.
    // Test/alternate stores must start empty and must never read another store's credential.
    const defaultPath = defaultAuthStorePath()
    const isDefaultStore = path.toLowerCase() === defaultPath.toLowerCase()
    const seed = isDefaultStore && options.importSeed === true ? tryFindSeedAccount() : undefined
    if (seed) {
      const initialId = 'acc_' + randomUUID().replace(/-/g, '').slice(0, 8)
      const data: MultiAccountStoreData = {
        version: MULTI_ACCOUNT_VERSION,
        activeAccountId: initialId,
        revision: 1,
        updatedAt: new Date(now()).toISOString(),
        accounts: [{
          id: initialId,
          email: seed.email,
          refreshToken: seed.refreshToken,
          projectId: seed.projectId,
          addedAt: new Date(now()).toISOString(),
          lineage: randomUUID(),
        }],
      }
      await writeRawStorage(path, data)
      return data
    }
    return {
      version: MULTI_ACCOUNT_VERSION,
      revision: 0,
      updatedAt: new Date(now()).toISOString(),
      accounts: [],
    }
  }

  return {
    read: async () => {
      const data = await loadData()
      if (!data.activeAccountId || data.accounts.length === 0) return undefined
      const active = data.accounts.find(a => a.id === data.activeAccountId) || data.accounts[0]
      if (!active) return undefined
      return toAuthRecord(active, data.revision, data.updatedAt)
    },

    commit: draft => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      const draftEmail = canonicalAccountEmail(draft.email)
      const existingIndex = draftEmail
        ? data.accounts.findIndex(a => canonicalAccountEmail(a.email) === draftEmail)
        : -1

      let accountId: string
      const lineage = draft.lineage ?? randomUUID()
      if (existingIndex >= 0) {
        const prev = data.accounts[existingIndex]!
        accountId = prev.id
        data.accounts[existingIndex] = {
          id: prev.id,
          addedAt: prev.addedAt,
          refreshToken: draft.refreshToken,
          projectId: draft.projectId,
          lineage,
          ...(draftEmail !== undefined ? { email: draftEmail } : prev.email !== undefined ? { email: prev.email } : {}),
        }
      } else {
        accountId = 'acc_' + randomUUID().replace(/-/g, '').slice(0, 8)
        data.accounts.push({
          id: accountId,
          refreshToken: draft.refreshToken,
          projectId: draft.projectId,
          addedAt: new Date(now()).toISOString(),
          lineage,
          ...(draftEmail !== undefined ? { email: draftEmail } : {}),
        })
      }
      data.activeAccountId = accountId
      data.revision += 1
      data.updatedAt = new Date(now()).toISOString()
      await writeRawStorage(path, data)

      const saved = data.accounts.find(a => a.id === accountId) ?? data.accounts[0]!
      return toAuthRecord(saved, data.revision, data.updatedAt)
    })),

    compareAndCommit: (expectedRevision, draft, expectedLineage) => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      if (data.revision !== expectedRevision) return undefined
      const active = data.accounts.find(a => a.id === data.activeAccountId)
      if (expectedLineage !== undefined && active?.lineage !== expectedLineage) return undefined

      const draftEmail = canonicalAccountEmail(draft.email)
      const existingIndex = draftEmail
        ? data.accounts.findIndex(a => canonicalAccountEmail(a.email) === draftEmail)
        : (data.activeAccountId ? data.accounts.findIndex(a => a.id === data.activeAccountId) : -1)

      let accountId: string
      const lineage = expectedLineage ?? draft.lineage ?? randomUUID()
      if (existingIndex >= 0) {
        const prev = data.accounts[existingIndex]!
        accountId = prev.id
        data.accounts[existingIndex] = {
          id: prev.id,
          addedAt: prev.addedAt,
          refreshToken: draft.refreshToken,
          projectId: draft.projectId,
          lineage,
          ...(draftEmail !== undefined ? { email: draftEmail } : prev.email !== undefined ? { email: prev.email } : {}),
        }
      } else {
        accountId = 'acc_' + randomUUID().replace(/-/g, '').slice(0, 8)
        data.accounts.push({
          id: accountId,
          refreshToken: draft.refreshToken,
          projectId: draft.projectId,
          addedAt: new Date(now()).toISOString(),
          lineage,
          ...(draftEmail !== undefined ? { email: draftEmail } : {}),
        })
      }
      data.activeAccountId = accountId
      data.revision = expectedRevision + 1
      data.updatedAt = new Date(now()).toISOString()
      await writeRawStorage(path, data)

      const saved = data.accounts.find(a => a.id === accountId) ?? data.accounts[0]!
      return toAuthRecord(saved, data.revision, data.updatedAt)
    })),

    clearIfCurrent: (expectedRevision, expectedLineage) => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      if (data.revision !== expectedRevision) return false
      const active = data.accounts.find(a => a.id === data.activeAccountId)
      if (expectedLineage !== undefined && active?.lineage !== expectedLineage) return false
      if (data.activeAccountId) {
        data.accounts = data.accounts.filter(a => a.id !== data.activeAccountId)
        data.activeAccountId = data.accounts.length > 0 ? data.accounts[0]!.id : undefined
        data.revision += 1
        data.updatedAt = new Date(now()).toISOString()
        await writeRawStorage(path, data)
      }
      return true
    })),

    clear: () => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      data.accounts = []
      data.activeAccountId = undefined
      data.revision += 1
      data.updatedAt = new Date(now()).toISOString()
      await writeRawStorage(path, data)
    })),

    listAccounts: async () => {
      const data = await loadData()
      const accounts: AccountSummary[] = data.accounts.map(a => ({
        id: a.id,
        projectId: a.projectId,
        addedAt: a.addedAt,
        active: a.id === data.activeAccountId,
        ...(a.email !== undefined ? { email: a.email } : {}),
      }))
      return {
        ...(data.activeAccountId !== undefined ? { activeAccountId: data.activeAccountId } : {}),
        accounts,
      }
    },

    switchAccount: async accountId => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      const target = data.accounts.find(a => a.id === accountId)
      if (!target) return undefined
      data.activeAccountId = accountId
      data.revision += 1
      data.updatedAt = new Date(now()).toISOString()
      await writeRawStorage(path, data)
      return toAuthRecord(target, data.revision, data.updatedAt)
    })),

    removeAccount: async accountId => enqueue(() => withStoreLock(path, async () => {
      const data = await loadData()
      const prevCount = data.accounts.length
      data.accounts = data.accounts.filter(a => a.id !== accountId)
      if (data.accounts.length === prevCount) return false
      if (data.activeAccountId === accountId) {
        data.activeAccountId = data.accounts.length > 0 ? data.accounts[0]!.id : undefined
      }
      data.revision += 1
      data.updatedAt = new Date(now()).toISOString()
      await writeRawStorage(path, data)
      return true
    })),
  }
}

/** An offline store useful for tests and process-local bootstrap fixtures. */
export function createMemoryAuthStore(initial?: AntigravityAuthRecord, options: AuthStoreOptions = {}): AntigravityAuthStore {
  const now = options.now ?? (() => Date.now())
  let current = initial === undefined ? undefined : cloneRecord(initial)
  const enqueue = createMutationQueue()
  return {
    read: async () => current === undefined ? undefined : cloneRecord(current),
    commit: draft => enqueue(async () => {
      current = makeRecord(draft, (current?.revision ?? 0) + 1, now())
      return cloneRecord(current)
    }),
    compareAndCommit: (expectedRevision, draft, expectedLineage) => enqueue(async () => {
      if ((current?.revision ?? 0) !== expectedRevision) return undefined
      const lineage = expectedLineage ?? draft.lineage
      if (lineage === undefined ? current?.lineage !== undefined : current?.lineage !== lineage) return undefined
      current = makeRecord(draft, expectedRevision + 1, now())
      return cloneRecord(current)
    }),
    clearIfCurrent: (expectedRevision, expectedLineage) => enqueue(async () => {
      if ((current?.revision ?? 0) !== expectedRevision) return false
      if (expectedLineage === undefined ? current?.lineage !== undefined : current?.lineage !== expectedLineage) return false
      current = undefined
      return true
    }),
    clear: () => enqueue(async () => { current = undefined }),
    listAccounts: async () => ({
      ...(current ? { activeAccountId: 'acc_default' } : {}),
      accounts: current ? [{
        id: 'acc_default',
        projectId: current.projectId,
        addedAt: current.updatedAt,
        active: true,
        ...(current.email !== undefined ? { email: current.email } : {}),
      }] : [],
    }),
    switchAccount: async () => current,
    removeAccount: async () => {
      current = undefined
      return true
    },
  }
}

function createMutationQueue() {
  let mutation: Promise<void> = Promise.resolve()
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = mutation.then(operation, operation)
    mutation = next.then(() => {}, () => {})
    return next
  }
}

async function withStoreLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const parent = dirname(path)
  await prepareParent(parent)
  const lockPath = join(parent, AUTH_STORE_LOCK_NAME)
  const deadline = Date.now() + AUTH_STORE_LOCK_TIMEOUT_MS

  while (true) {
    try {
      const handle = await open(lockPath, 'wx', 0o600)
      try {
        await handle.writeFile(`${process.pid}\n`, 'utf8')
        await handle.sync()
        return await operation()
      } finally {
        await handle.close().catch(() => {})
        await unlink(lockPath).catch(() => {})
      }
    } catch (error) {
      if (error instanceof AuthStoreError) throw error
      if (!isAlreadyExists(error)) throw storeIoError()
      await removeStaleLock(lockPath)
      if (Date.now() >= deadline) throw conflictError()
      await new Promise<void>(resolve => setTimeout(resolve, AUTH_STORE_LOCK_RETRY_MS))
    }
  }
}

async function prepareParent(parent: string): Promise<void> {
  try {
    const parentInfo = await lstat(parent)
    if (parentInfo.isSymbolicLink() || !parentInfo.isDirectory()) throw unsafePermissionsError()
  } catch (error) {
    if (!isNotFound(error)) throw error
  }
  try {
    await mkdir(parent, { recursive: true, mode: 0o700 })
    await chmod(parent, 0o700)
  } catch (error) {
    if (error instanceof AuthStoreError) throw error
    throw storeIoError()
  }
}

async function syncDirectory(path: string): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close().catch(() => {})
  }
}

async function removeStaleLock(path: string): Promise<void> {
  try {
    const info = await lstat(path)
    if (Date.now() - info.mtimeMs > AUTH_STORE_LOCK_STALE_MS) await unlink(path).catch(() => {})
  } catch (error) {
    if (!isNotFound(error)) return
  }
}

async function readRawStorage(path: string, platform: NodeJS.Platform): Promise<MultiAccountStoreData | undefined> {
  let fileInfo
  try {
    fileInfo = await lstat(path)
  } catch (error) {
    if (isNotFound(error)) return undefined
    throw storeIoError()
  }
  if (fileInfo.isSymbolicLink() || !fileInfo.isFile()) throw unsafePermissionsError()
  await assertOwnerOnly(path, platform)

  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    throw storeIoError()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw corruptError()
  }

  if (!isRecord(parsed)) throw corruptError()

  // Case 1: MultiAccountStoreData (v2)
  if (parsed.version === MULTI_ACCOUNT_VERSION && Array.isArray(parsed.accounts)) {
    return {
      version: MULTI_ACCOUNT_VERSION,
      ...(typeof parsed.activeAccountId === 'string' ? { activeAccountId: parsed.activeAccountId } : {}),
      accounts: (parsed.accounts as unknown[]).filter(isRecord).map(a => ({
        id: String(a.id || randomUUID()),
        refreshToken: String(a.refreshToken || ''),
        projectId: String(a.projectId || 'aicode-consumers'),
        addedAt: typeof a.addedAt === 'string' ? a.addedAt : new Date().toISOString(),
        ...(typeof a.email === 'string' ? { email: a.email } : {}),
        ...(typeof a.lineage === 'string' ? { lineage: a.lineage } : {}),
      })).filter(a => a.refreshToken.length > 0),
      revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  }

  // Case 2: Legacy single account (v1)
  if (parsed.version === AUTH_RECORD_VERSION) {
    const rec = parseRecord(parsed)
    const accId = 'acc_' + randomUUID().replace(/-/g, '').slice(0, 8)
    return {
      version: MULTI_ACCOUNT_VERSION,
      activeAccountId: accId,
      accounts: [{
        id: accId,
        refreshToken: rec.refreshToken,
        projectId: rec.projectId,
        addedAt: rec.updatedAt,
        ...(rec.email !== undefined ? { email: rec.email } : {}),
        ...(rec.lineage !== undefined ? { lineage: rec.lineage } : {}),
      }],
      revision: rec.revision,
      updatedAt: rec.updatedAt,
    }
  }

  throw unsupportedVersionError()
}

async function writeRawStorage(path: string, data: MultiAccountStoreData): Promise<void> {
  const parent = dirname(path)
  try {
    await prepareParent(parent)
    const temporary = join(parent, `.${randomUUID()}.tmp`)
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close().catch(() => {})
      }
      await chmod(temporary, 0o600)
      await rename(temporary, path)
      await chmod(path, 0o600)
      await syncDirectory(parent)
    } catch {
      await unlink(temporary).catch(() => {})
      throw storeIoError()
    }
  } catch (error) {
    if (error instanceof AuthStoreError) throw error
    throw storeIoError()
  }
}

export function makeAuthRecord(draft: AuthRecordDraft, revision: number, now = Date.now()): AntigravityAuthRecord {
  return makeRecord(draft, revision, now)
}

function makeRecord(draft: AuthRecordDraft, revision: number, now: number): AntigravityAuthRecord {
  if (!isRecord(draft)
    || !isBoundedSafeText(draft.refreshToken, 4096)
    || !isBoundedSafeText(draft.projectId, 4096)
    || (draft.lineage !== undefined && !isBoundedSafeText(draft.lineage, 4096))
    || !Number.isSafeInteger(revision)
    || revision < 1
    || !Number.isFinite(now)) {
    throw corruptError()
  }
  const record: AntigravityAuthRecord = {
    version: AUTH_RECORD_VERSION,
    refreshToken: draft.refreshToken,
    projectId: draft.projectId,
    revision,
    updatedAt: new Date(now).toISOString(),
    ...(draft.lineage !== undefined ? { lineage: draft.lineage } : { lineage: randomUUID() }),
    ...(draft.email !== undefined ? { email: validateEmail(draft.email) } : {}),
  }
  return record
}

function parseRecord(value: unknown): AntigravityAuthRecord {
  if (!isRecord(value)) throw corruptError()
  if (value.version !== AUTH_RECORD_VERSION) throw unsupportedVersionError()
  const refreshToken = value.refreshToken
  const projectId = value.projectId
  const revision = value.revision
  const updatedAt = value.updatedAt
  const lineage = value.lineage
  if (!isBoundedSafeText(refreshToken, 4096)
    || !isBoundedSafeText(projectId, 4096)
    || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1
    || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))
    || (lineage !== undefined && !isBoundedSafeText(lineage, 4096))) {
    throw corruptError()
  }
  const email = value.email
  if (email !== undefined && !isBoundedSafeText(email, 4096)) throw corruptError()
  return {
    version: AUTH_RECORD_VERSION,
    refreshToken,
    projectId,
    revision,
    updatedAt,
    ...(email !== undefined ? { email } : {}),
    ...(lineage !== undefined ? { lineage } : {}),
  }
}

async function assertOwnerOnly(path: string, platform: NodeJS.Platform): Promise<void> {
  try {
    const file = await lstat(path)
    const parent = await lstat(dirname(path))
    const unsafePosixMode = platform !== 'win32'
      && ((file.mode & 0o077) !== 0 || (parent.mode & 0o077) !== 0)
    if (file.isSymbolicLink() || parent.isSymbolicLink() || !parent.isDirectory() || unsafePosixMode) {
      throw unsafePermissionsError()
    }
  } catch (error) {
    if (error instanceof AuthStoreError) throw error
    throw storeIoError()
  }
}

function validateEmail(value: string): string {
  if (!isBoundedSafeText(value, 4096) || !value.includes('@')) throw corruptError()
  return value
}

function cloneRecord(record: AntigravityAuthRecord): AntigravityAuthRecord {
  return { ...record }
}

function corruptError(): AuthStoreError {
  return new AuthStoreError('AUTH_STORE_CORRUPT', 'The Antigravity auth store is not valid')
}

function unsupportedVersionError(): AuthStoreError {
  return new AuthStoreError('AUTH_STORE_UNSUPPORTED_VERSION', 'The Antigravity auth store version is unsupported')
}

function unsafePermissionsError(): AuthStoreError {
  return new AuthStoreError('AUTH_STORE_UNSAFE_PERMISSIONS', 'The Antigravity auth store permissions are unsafe')
}

function storeIoError(): AuthStoreError {
  return new AuthStoreError('AUTH_STORE_IO', 'The Antigravity auth store could not be accessed')
}

function conflictError(): AuthStoreError {
  return new AuthStoreError('AUTH_STORE_CONFLICT', 'The Antigravity auth store is busy')
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'EEXIST'
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
