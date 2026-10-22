// Copyright © 2026 Zolvat Ltd

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const policy = fs.readFileSync(path.join(root, '.npmrc'), 'utf8')
const npmCli = process.env.npm_execpath
assert.ok(npmCli, 'Run this test through npm run test:npm-policy with the pinned npm version')
const npmPackage = JSON.parse(
  fs.readFileSync(path.resolve(path.dirname(npmCli), '../package.json'), 'utf8')
)
assert.equal(`npm@${npmPackage.version}`, manifest.packageManager)

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'headlessui npm policy '))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const userConfig = path.join(temporary, 'user.npmrc')
  const globalConfig = path.join(temporary, 'global.npmrc')
  fs.writeFileSync(userConfig, '')
  fs.writeFileSync(globalConfig, '')
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_'))
  )

  function npm(args, cwd) {
    const result = spawnSync(
      process.execPath,
      [
        npmCli,
        ...args,
        '--offline',
        '--no-audit',
        '--no-fund',
        '--cache',
        path.join(temporary, 'cache'),
        '--userconfig',
        userConfig,
        '--globalconfig',
        globalConfig,
      ],
      { cwd, env: environment, encoding: 'utf8', timeout: 15000 }
    )
    assert.ifError(result.error)
    return result
  }

  function project(name, allowScripts = manifest.allowScripts) {
    const directory = path.join(temporary, name)
    fs.mkdirSync(directory)
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        allowScripts,
        dependencies: { esbuild: 'file:../esbuild-0.28.2.tgz' },
      })
    )
    fs.writeFileSync(path.join(directory, '.npmrc'), policy)
    return directory
  }

  function pack(name, dependencies = {}) {
    const directory = path.join(temporary, `source-${name}`)
    fs.mkdirSync(directory)
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name,
        version: name === 'esbuild' ? '0.28.2' : '1.0.0',
        dependencies,
        scripts: { postinstall: 'node hook.cjs' },
      })
    )
    fs.writeFileSync(
      path.join(directory, 'hook.cjs'),
      'require("node:fs").writeFileSync("script-ran", "executed")\n'
    )
    const packed = npm(
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary],
      directory
    )
    assert.equal(packed.status, 0, packed.stderr)
    return JSON.parse(packed.stdout)[name].filename
  }

  const marker = (directory) => path.join(directory, 'node_modules/esbuild/script-ran')
  return { temporary, npm, project, pack, marker, environment, userConfig }
}

test('root owns exact reviewed approvals for every locked install script', (t) => {
  const { npm } = fixture(t)
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  const scripts = [
    ...new Set(
      Object.values(lock.packages)
        .filter((entry) => entry.hasInstallScript)
        .map((entry) => {
          const name = entry.resolved.match(/registry\.npmjs\.org\/(.+)\/-\//)?.[1]
          assert.ok(name, `Review the non-registry lifecycle source: ${entry.resolved}`)
          return `${name}@${entry.version}`
        })
    ),
  ]
  assert.deepEqual(Object.keys(manifest.allowScripts).sort(), scripts.sort())
  assert.equal(manifest.allowScripts['fsevents@2.3.3'], false)
  assert.equal(Object.values(manifest.allowScripts).filter((value) => value === true).length, 6)
  for (const setting of ['strict-allow-scripts', 'strict-npmrc', 'allow-git', 'allow-remote']) {
    const result = npm(['config', 'get', setting], root)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), setting.startsWith('strict-') ? 'true' : 'none')
  }
})

test('unknown hooks are blocked, source approvals execute, and explicit denials skip', (t) => {
  const { npm, project, pack, marker } = fixture(t)
  assert.equal(pack('esbuild'), 'esbuild-0.28.2.tgz')
  const source = 'file:../esbuild-0.28.2.tgz'

  // The tarball claims an approved registry identity but must not inherit its permission.
  const unknown = project('unknown')
  const blocked = npm(['install'], unknown)
  assert.notEqual(blocked.status, 0)
  assert.match(blocked.stderr, /ESTRICTALLOWSCRIPTS/)
  assert.equal(fs.existsSync(marker(unknown)), false)

  const approved = project('approved', { ...manifest.allowScripts, [source]: true })
  const allowed = npm(['install'], approved)
  assert.equal(allowed.status, 0, allowed.stderr)
  assert.equal(fs.readFileSync(marker(approved), 'utf8'), 'executed')

  const denied = project('denied', { ...manifest.allowScripts, [source]: false })
  const skipped = npm(['install'], denied)
  assert.equal(skipped.status, 0, skipped.stderr)
  assert.equal(fs.existsSync(marker(denied)), false)

  fs.appendFileSync(path.join(denied, '.npmrc'), 'unrecognized-policy-setting=true\n')
  const unknownConfig = npm(['install'], denied)
  assert.notEqual(unknownConfig.status, 0)
  assert.match(unknownConfig.stderr, /unrecognized-policy-setting/)
  const unknownFlag = npm(['install', '--unrecognized-policy-flag'], approved)
  assert.notEqual(unknownFlag.status, 0)
  assert.match(unknownFlag.stderr, /unrecognized-policy-flag/)
  const abbreviatedFlag = npm(['install', '--foreg'], approved)
  assert.notEqual(abbreviatedFlag.status, 0)
  assert.match(abbreviatedFlag.stderr, /foreg/)
  const cliApproval = npm(['install', '--allow-scripts=esbuild'], approved)
  assert.notEqual(cliApproval.status, 0)
  assert.match(cliApproval.stderr, /EALLOWSCRIPTS/)
})

test('CI bootstraps and registry authentication remain compatible with strict npmrc', (t) => {
  const { npm, project, userConfig, environment } = fixture(t)
  const directory = project('registry-auth')
  const file = path.join(directory, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  delete pkg.dependencies
  fs.writeFileSync(file, JSON.stringify(pkg))
  environment.NODE_AUTH_TOKEN = 'offline-fixture-token'
  const auth =
    '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nregistry=https://registry.npmjs.org/\n'

  // setup-node v4/v5 emitted this removed setting even when its input was empty.
  fs.writeFileSync(userConfig, `${auth}always-auth=false\n`)
  const incompatible = npm(['install'], directory)
  assert.notEqual(incompatible.status, 0)
  assert.match(incompatible.stderr, /always-auth/)
  fs.writeFileSync(userConfig, auth)
  const compatible = npm(['install'], directory)
  assert.equal(compatible.status, 0, compatible.stderr)
  const registry = npm(['config', 'get', 'registry'], directory)
  assert.equal(registry.status, 0, registry.stderr)
  assert.equal(registry.stdout.trim(), 'https://registry.npmjs.org/')
  assert.equal(fs.readFileSync(userConfig, 'utf8'), auth)

  let bootstraps = 0
  for (const file of fs.readdirSync(path.join(root, '.github/workflows'))) {
    const workflow = parse(fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8'))
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses?.startsWith('actions/setup-node@')) {
          assert.equal(step.uses, 'actions/setup-node@v6')
          assert.equal(step.with['node-version-file'], '.nvmrc')
          assert.equal(step.with['package-manager-cache'], false)
        }
        if (step.name === 'Use repository npm version') {
          assert.match(step.run, /npm install --global --ignore-scripts/)
          assert.ok(step.run.includes('require("./package.json").packageManager'))
          bootstraps++
        }
      }
    }
  }
  assert.equal(bootstraps, 8)
})

test('Git and non-registry URLs are denied directly and transitively without network access', (t) => {
  const { npm, project, pack } = fixture(t)
  for (const [kind, spec, error] of [
    ['remote', 'https://unreviewed.invalid/package.tgz', /EALLOWREMOTE/],
    ['git', 'git+https://unreviewed.invalid/package.git#0123456789abcdef', /EALLOWGIT/],
  ]) {
    const tarball = pack(`${kind}-parent`, { child: spec })
    for (const transitive of [false, true]) {
      const directory = project(`${kind}-${transitive ? 'transitive' : 'direct'}`)
      const file = path.join(directory, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
      pkg.dependencies = transitive ? { [`${kind}-parent`]: `file:../${tarball}` } : { child: spec }
      fs.writeFileSync(file, JSON.stringify(pkg))
      const rejected = npm(['install'], directory)
      assert.notEqual(rejected.status, 0)
      assert.match(rejected.stderr, error)
    }
  }
})

test('workspace installs use root approvals, not conflicting child policies', (t) => {
  const { npm, project, pack, marker } = fixture(t)
  pack('esbuild')
  const source = 'file:../esbuild-0.28.2.tgz'
  for (const approval of [undefined, true, false]) {
    const directory = project(`workspace-${approval}`, {
      ...manifest.allowScripts,
      ...(approval === undefined ? {} : { [source]: approval }),
    })
    const file = path.join(directory, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
    delete pkg.dependencies
    pkg.workspaces = ['packages/*']
    fs.writeFileSync(file, JSON.stringify(pkg))
    const child = path.join(directory, 'packages/child')
    fs.mkdirSync(child, { recursive: true })
    fs.writeFileSync(
      path.join(child, 'package.json'),
      JSON.stringify({
        name: 'child',
        version: '1.0.0',
        allowScripts: { 'file:../../../esbuild-0.28.2.tgz': approval !== true },
        dependencies: { esbuild: 'file:../../../esbuild-0.28.2.tgz' },
      })
    )

    const result = npm(['install'], child)
    if (approval === undefined) {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /ESTRICTALLOWSCRIPTS/)
    } else {
      assert.equal(result.status, 0, result.stderr)
    }
    assert.equal(fs.existsSync(marker(directory)), approval === true)
  }
})

test('the reviewed Husky installer preserves normal maintainer hooks in an isolated Git repo', (t) => {
  const { temporary, environment } = fixture(t)
  const directory = path.join(temporary, 'maintainer')
  fs.mkdirSync(directory)
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'maintainer',
      version: '1.0.0',
      husky: { skipCI: false, hooks: { 'pre-commit': 'node hook.cjs' } },
    })
  )
  fs.writeFileSync(
    path.join(directory, 'hook.cjs'),
    'require("node:fs").writeFileSync("maintainer-hook-ran", "executed")\n'
  )
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'junction')
  const env = Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) => !key.startsWith('GIT_') && !key.startsWith('HUSKY_')
    )
  )
  Object.assign(env, {
    INIT_CWD: directory,
    npm_config_user_agent: process.env.npm_config_user_agent,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(temporary, 'global.npmrc'),
  })
  const initialized = spawnSync('git', ['init', '--quiet', '--template='], {
    cwd: directory,
    env,
    encoding: 'utf8',
  })
  assert.ifError(initialized.error)
  assert.equal(initialized.status, 0, initialized.stderr)
  const installed = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules/husky/husky.js'), 'install'],
    { cwd: directory, env, encoding: 'utf8', timeout: 15000 }
  )
  assert.ifError(installed.error)
  assert.equal(installed.status, 0, installed.stderr)
  const hook = path.join(directory, '.git/hooks/pre-commit')
  assert.match(fs.readFileSync(hook, 'utf8'), /husky/)
  const executed = spawnSync('sh', [hook], {
    cwd: directory,
    env,
    encoding: 'utf8',
    timeout: 15000,
  })
  assert.ifError(executed.error)
  assert.equal(executed.status, 0, executed.stderr)
  assert.equal(fs.readFileSync(path.join(directory, 'maintainer-hook-ran'), 'utf8'), 'executed')
})

test('release helper output and workspace version/pack preparation work without publishing', (t) => {
  const { temporary, npm, project } = fixture(t)
  const tag = '@headlessui/vue@1.7.24-iremizov.2'
  for (const script of ['release-channel', 'package-path', 'release-notes']) {
    const direct = spawnSync(process.execPath, [path.join(root, `scripts/${script}.js`), tag], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.ifError(direct.error)
    assert.equal(direct.status, 0, direct.stderr)
    const throughNpm = npm(['run', script, tag, '--silent'], root)
    assert.equal(throughNpm.status, 0, throughNpm.stderr)
    assert.equal(throughNpm.stdout, direct.stdout, `${script} must not include npm log output`)
  }

  const directory = project('release')
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'release', version: '1.0.0', private: true, workspaces: ['packages/*'] })
  )
  const child = path.join(directory, 'packages/child')
  fs.mkdirSync(child, { recursive: true })
  fs.writeFileSync(
    path.join(child, 'package.json'),
    JSON.stringify({
      name: 'release-child',
      version: '1.0.0',
      files: ['entry.js'],
      scripts: {
        prepack: 'node hook.cjs',
        prepublishOnly: 'node -e "throw new Error(\'Publishing is outside this test\')"',
      },
    })
  )
  fs.writeFileSync(path.join(child, 'entry.js'), 'module.exports = "release fixture"\n')
  fs.writeFileSync(
    path.join(child, 'hook.cjs'),
    'require("node:fs").writeFileSync("prepack-ran", "executed")\n'
  )
  const versioned = npm(
    ['version', '-w', 'packages', '0.0.0-insiders.abc1234', '--force', '--no-git-tag-version'],
    directory
  )
  assert.equal(versioned.status, 0, versioned.stderr)
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(child, 'package.json'), 'utf8')).version,
    '0.0.0-insiders.abc1234'
  )
  const packed = npm(
    ['pack', '--workspace=release-child', '--json', '--pack-destination', temporary],
    directory
  )
  assert.equal(packed.status, 0, packed.stderr)
  const archive = JSON.parse(packed.stdout)['release-child']
  assert.ok(archive.files.some((file) => file.path === 'entry.js'))
  assert.ok(fs.statSync(path.join(temporary, archive.filename)).size > 0)
  assert.equal(fs.readFileSync(path.join(child, 'prepack-ran'), 'utf8'), 'executed')
})
