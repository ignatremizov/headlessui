// Copyright © 2026 Zolvat Ltd

const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

// Exercise the real loader used by Jest's Babel coverage dependency, not a substitute parser.
const jestRequire = createRequire(require.resolve('jest'))
const coreRequire = createRequire(jestRequire.resolve('@jest/core'))
const transformRequire = createRequire(coreRequire.resolve('@jest/transform'))
const babelRequire = createRequire(transformRequire.resolve('babel-plugin-istanbul'))
const loaderRequire = createRequire(babelRequire.resolve('@istanbuljs/load-nyc-config'))
const { loadNycConfig, isLoading } = loaderRequire('@istanbuljs/load-nyc-config')

let cwd

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'headlessui-coverage-config-'))
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({ private: true, nyc: { reporter: ['text'], 'check-coverage': true } })
  )
})

afterEach(() => rmSync(cwd, { recursive: true, force: true }))

it('uses the maintained YAML parser through the actual coverage configuration loader', () => {
  expect(loaderRequire('js-yaml/package.json').version).toBe('4.3.2')
  expect(typeof loaderRequire('js-yaml').load).toBe('function')
})

it('loads YAML, relative extends, booleans, arrays, and normalized configuration keys', async () => {
  writeFileSync(join(cwd, 'base.yaml'), 'exclude: ["**/*.test.ts"]\nall: true\n')
  writeFileSync(
    join(cwd, '.nycrc.yaml'),
    'extends: ./base.yaml\ninclude: src/**/*.ts\nextension: [.ts, .tsx]\nreporter: [json, text]\n'
  )

  await expect(loadNycConfig({ cwd })).resolves.toEqual({
    cwd,
    reporter: ['json', 'text'],
    checkCoverage: true,
    include: ['src/**/*.ts'],
    extension: ['.ts', '.tsx'],
    exclude: ['**/*.test.ts'],
    all: true,
  })
  expect(isLoading()).toBe(false)
})

it('continues to load JSON and CommonJS configuration', async () => {
  writeFileSync(join(cwd, 'base.json'), JSON.stringify({ include: 'src/**/*.tsx' }))
  writeFileSync(
    join(cwd, 'nyc.config.cjs'),
    "module.exports = { extends: './base.json', all: true }"
  )

  await expect(loadNycConfig({ cwd })).resolves.toEqual({
    cwd,
    reporter: ['text'],
    checkCoverage: true,
    include: ['src/**/*.tsx'],
    all: true,
  })
})

it('rejects duplicate YAML keys and resets the loader state after a parse failure', async () => {
  writeFileSync(join(cwd, '.nycrc.yaml'), 'all: true\nall: false\n')

  await expect(loadNycConfig({ cwd })).rejects.toThrow('duplicated mapping key')
  expect(isLoading()).toBe(false)
})

it('rejects executable YAML tags instead of adding compatibility aliases', async () => {
  writeFileSync(join(cwd, '.nycrc.yaml'), 'hook: !!js/function "function () { return true }"\n')

  await expect(loadNycConfig({ cwd })).rejects.toThrow('unknown tag')
  expect(isLoading()).toBe(false)
})
