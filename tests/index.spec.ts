import { describe, expect, it } from 'vitest'
import { ACCOUNT_RPC_ENDPOINTS } from '../src/index.ts'

describe('Antigravity Host account route registration', () => {
  it('exposes every browser account-management endpoint', () => {
    expect(ACCOUNT_RPC_ENDPOINTS).toEqual(expect.arrayContaining([
      'status',
      'models',
      'usage',
      'switch-account',
      'remove-account',
    ]))
  })
})
