/** Types and helpers for DSH profile-backed, live plugin Config fields. */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

export type ConfigField<T> = T | Volatile<T>

export function readConfigField<T>(value: ConfigField<T>): T {
  if (typeof value === 'object' && value !== null && 'get' in value && typeof value.get === 'function') {
    return (value as Volatile<T>).get() as T
  }
  return value as T
}

/** Keep the custom Antigravity page as the only settings surface for each capability row. */
export function disableGeneratedSettingsPage(ctx: Context, label: string): void {
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), label)
  })
}

/** Reconcile runtime registrations when DSH applies a profile's volatile fields. */
export function watchVolatileConfig(ctx: Context, listener: () => void, label: string): void {
  ctx.effect(() => {
    if (typeof ctx.on !== 'function') return () => {}
    return ctx.on('loader/volatile-update', listener)
  }, label)
}
