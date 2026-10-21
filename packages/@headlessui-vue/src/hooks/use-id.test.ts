// Copyright © 2026 Zolvat Ltd

import { defineComponent, h, nextTick, ref, useId as useVueId } from 'vue'
import { render, screen } from '../test-utils/vue-testing-library'
import { provideUseId, useId } from './use-id'

it('preserves native Vue IDs across re-renders', async () => {
  let count = ref(0)
  let nativeId = ''

  render(
    defineComponent({
      setup() {
        let id = useId()
        nativeId = useVueId()
        return () => h('output', { id }, count.value)
      },
    })
  )

  let output = screen.getByRole('status')
  let id = output.id
  expect(id).toMatch(/^v-/)
  expect(id).not.toEqual(nativeId)

  count.value += 1
  await nextTick()

  expect(output.id).toEqual(id)
  expect(output.textContent).toEqual('1')
})

it('uses an explicitly provided generator before the native Vue generator', () => {
  let generateId = jest.fn(() => 'custom-id')
  let Child = defineComponent({
    setup() {
      let id = useId()
      return () => h('output', { id }, 'Child')
    },
  })

  render(
    defineComponent({
      setup() {
        provideUseId(generateId)
        return () => h(Child)
      },
    })
  )

  expect(screen.getByRole('status').id).toEqual('custom-id')
  expect(generateId).toHaveBeenCalledTimes(1)
})
