// Copyright © 2026 Zolvat Ltd

import { execFileSync } from 'child_process'
import path from 'path'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import hui from './index'

let html = String.raw

function run(input: string, config: any, plugin = tailwind) {
  let { currentTestName } = expect.getState()

  // @ts-ignore
  return postcss(plugin(config)).process(input, {
    from: `${path.resolve(__filename)}?test=${currentTestName}`,
  })
}

it('should generate css for an exposed state', async () => {
  let config = {
    content: [{ raw: html`<div class="ui-open:underline"></div>` }],
    plugins: [hui],
  }

  return run('@tailwind utilities', config).then((result) => {
    expect(result.css).toMatchSnapshot()
  })
})

it('should generate the inverse "not" css for an exposed state', async () => {
  let config = {
    content: [{ raw: html`<div class="ui-not-open:underline"></div>` }],
    plugins: [hui],
  }

  return run('@tailwind utilities', config).then((result) => {
    expect(result.css).toMatchSnapshot()
  })
})

it('should generate the ui-focus-visible variant', async () => {
  let config = {
    content: [{ raw: html`<div class="ui-focus-visible:underline"></div>` }],
    plugins: [hui],
  }

  return run('@tailwind utilities', config).then((result) => {
    expect(result.css).toMatchSnapshot()
  })
})

it('should generate the ui-not-focus-visible variant', async () => {
  let config = {
    content: [{ raw: html`<div class="ui-not-focus-visible:underline"></div>` }],
    plugins: [hui],
  }

  return run('@tailwind utilities', config).then((result) => {
    expect(result.css).toMatchSnapshot()
  })
})

describe('custom prefix', () => {
  it('should generate css for an exposed state', async () => {
    let config = {
      content: [{ raw: html`<div class="hui-open:underline"></div>` }],
      plugins: [hui({ prefix: 'hui' })],
    }

    return run('@tailwind utilities', config).then((result) => {
      expect(result.css).toMatchSnapshot()
    })
  })

  it('should generate the inverse "not" css for an exposed state', async () => {
    let config = {
      content: [{ raw: html`<div class="hui-not-open:underline"></div>` }],
      plugins: [hui({ prefix: 'hui' })],
    }

    return run('@tailwind utilities', config).then((result) => {
      expect(result.css).toMatchSnapshot()
    })
  })
})

it('preserves typography selectors with the patched selector parser', () => {
  // Exercise Node's package-exports support, which Jest 26's resolver does not implement.
  let css = execFileSync(
    process.execPath,
    [
      '-e',
      `
        const postcss = require('postcss')
        const tailwind = require('tailwindcss')
        const typography = require('@tailwindcss/typography')
        const config = {
          content: [{ raw: '<article class="prose prose-headings:underline"></article>' }],
          plugins: [typography],
        }
        postcss(tailwind(config))
          .process('@tailwind components; @tailwind utilities', { from: undefined })
          .then((result) => process.stdout.write(result.css))
          .catch((error) => { console.error(error); process.exitCode = 1 })
      `,
    ],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  )

  expect(css).toContain('.prose {')
  expect(css).toContain(':where(h1)')
  expect(css).toContain('[class~="not-prose"]')
  expect(css).toContain('.prose-headings\\:underline')
  expect(css).toContain('text-decoration-line: underline')
})
