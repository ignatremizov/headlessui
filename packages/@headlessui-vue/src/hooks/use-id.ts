import * as Vue from 'vue'

let GENERATE_ID: Vue.InjectionKey<() => string> = Symbol('headlessui.useid')
let globalId = 0

export function useId() {
  // Prefer explicitly provided ID generators (for SSR stability / framework integration).
  let generateId = Vue.inject(GENERATE_ID, null)
  if (generateId) return generateId()

  // Fallback to Vue's built-in `useId` when available.
  // @ts-ignore - `useId` doesn't exist in Vue < 3.5.
  if (Vue.useId) return Vue.useId()

  return `${++globalId}`
}
/**
 * This function allows users to provide a custom ID generator.
 */
export function provideUseId(fn: () => string) {
  Vue.provide(GENERATE_ID, fn)
}
