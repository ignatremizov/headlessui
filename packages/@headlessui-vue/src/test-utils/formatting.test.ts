// Copyright © 2026 Zolvat Ltd

import { mount } from '@vue/test-utils'
import { h } from 'vue'

it('preserves inline content, attributes, and literal preformatted whitespace', () => {
  let wrapper = mount({
    render: () =>
      h('div', { 'data-state': 'open' }, [
        h('span', 'Selected account'),
        h('input', { disabled: true, value: 'EUR' }),
        h('pre', '  keep\n    spacing'),
      ]),
  })

  try {
    expect(wrapper.html()).toEqual(
      '<div data-state="open"><span>Selected account</span><input disabled="" value="EUR"><pre>  keep\n    spacing</pre>\n</div>'
    )
  } finally {
    wrapper.unmount()
  }
})

it('preserves escaped text and custom-element formatting', () => {
  let wrapper = mount({
    render: () =>
      h('section', [
        h('p', 'Balance < 100 & approved'),
        h('account-summary', { 'data-currency': 'EUR' }, [h('strong', 'Confirmed')]),
      ]),
  })

  try {
    expect(wrapper.html()).toEqual(
      '<section>\n  <p>Balance &lt; 100 &amp; approved</p>\n  <account-summary data-currency="EUR"><strong>Confirmed</strong></account-summary>\n</section>'
    )
  } finally {
    wrapper.unmount()
  }
})
