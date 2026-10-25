# Contributing

Thanks for your interest in contributing to Headless UI! Please take a moment to review this document **before submitting a pull request**.

- [Pull requests](#pull-requests)
- [Monorepo](#monorepo)
- [Installation](#installation)
- [Coding standards](#coding-standards)
- [Running tests](#running-tests)
- [Running playgrounds](#running-playgrounds)
- [Scripts summary](#scripts-summary)

## Pull requests

**Please ask first before starting work on any significant new features.**

It's never a fun experience to have your pull request declined after investing a lot of time and effort into a new feature. To avoid this from happening, we request that contributors create [an issue](https://github.com/tailwindlabs/headlessui/issues) to first discuss any significant new features. This includes things like adding new components, exposing internal information, etc. Also make sure that you are making changes to both the `React` and `Vue` versions so that we can ensure feature parity.

## Monorepo

The Headless UI repo is a monorepo using `npm` workspaces.

## Installation

Use the Node version in `.nvmrc` and npm `12.2.1`, pinned in the root `packageManager` field. Install from the workspace root:

```sh
npm ci
```

CI and release jobs bootstrap that npm version with `--ignore-scripts`, then run an ordinary `npm ci` under the reviewed project policy. Do not use a blanket script bypass for project installation. The workflows use `actions/setup-node@v6`, whose registry authentication file no longer contains the removed `always-auth` option rejected by strict npmrc validation. Automatic action caching is disabled because the existing explicit dependency cache already includes the toolchain, policy, manifest, and lockfile.

### Dependency installation policy

The root `allowScripts` field owns install-script permissions for all workspaces. Approvals are exact registry package versions; workspace manifests do not override them. The root `.npmrc` rejects unreviewed lifecycle scripts, unknown npmrc keys, Git dependencies, and non-registry remote tarball URLs. Local workspace links remain supported.

| Locked package          | Decision and purpose                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `@parcel/watcher@2.6.0` | Allow the explicit native source-build hook. Normal prebuilt installs do not compile.        |
| `@swc/core@1.16.20`     | Allow native-binding validation and the upstream fallback installer.                         |
| `esbuild@0.28.2`        | Allow binary selection, integrity checks, and version validation.                            |
| `husky@4.3.8`           | Allow existing maintainer Git-hook installation and the upstream funding message.            |
| `unrs-resolver@1.12.2`  | Allow native-binding preparation and the upstream fallback installer.                        |
| `vue-demi@0.14.10`      | Allow selection of the installed Vue version's compatibility shim.                           |
| `fsevents@2.3.3`        | Deny an unnecessary native rebuild; the optional Darwin archive already includes its binary. |

Native installers may fetch their upstream platform fallback when optional binaries are missing. Keep optional dependencies installed. These approvals are not a network sandbox. On shared worktrees, use `HUSKY_SKIP_INSTALL=1 npm ci` to avoid replacing shared Git hooks; normal maintainer installs retain the existing Husky behavior.

When upgrading a dependency with lifecycle scripts, inspect its actual locked script and helpers, update the exact approval or denial, and rerun `npm run test:npm-policy` and the normal validation gates. Use `npm install-scripts ls --json` to inspect pending decisions. Do not approve all scripts or add broad source permissions to clear an install error. Unknown user/global npmrc settings must be reviewed by their owner; do not disable `strict-npmrc` to hide them. Unknown or abbreviated CLI flags are errors under npm 12; use supported full flags and `--` when forwarding script arguments.

`npm run test:npm-policy` runs offline fixtures proving unknown/approved/denied behavior, source identity boundaries, root ownership from workspace directories, and strict config validation. It also checks the actual Husky installer and generated hook in an isolated Git repository, release helper argument forwarding, and workspace version/pack preparation without publishing.

## Coding standards

We use `prettier` for making sure that the codebase is formatted consistently. To automatically fix any style violations in your code, you can run:

```sh
npm lint
```

**Note**: Whenever you commit, the lint check will run on all staged files. **Note**: In CI, we will only check your code, and not write with the formatted files. If you want to just check, then you can either run `npm run lint-check` or `CI=true npm run lint`

## Running tests

You can run the test suite using the following commands:

```sh
npm run test
```

You can also run them for React or Vue individually:

```sh
npm run react test

# or

npm run vue test
```

Please ensure that the tests are passing when submitting a pull request. If you're adding new features to Headless UI, please include tests.

### Test runner and coverage

The repository uses Jest 30 and its supported JSDOM 26 environment. Tests retain the existing snapshot format; Jest may update generated snapshot documentation links without changing the expected values. DOM timeline tests use `jest-diff` directly, rather than a second Jest version through `snapshot-diff`.

Run the complete suite with V8 coverage using:

```sh
npm test -- --maxWorkers=2 --coverage
```

The interaction helpers advance timeout timers while keeping the immediate, animation-frame, and microtask queues real so rendering and focus changes can settle. The shared setup exposes Node's native immediate APIs, which are no longer provided by the JSDOM environment. Browser interactions should identify focus destinations explicitly, and implicit form-submission test helpers should use `requestSubmit()` to dispatch a real submit event.

Jest's transform dependency still includes the NYC configuration loader, even with V8 coverage. The narrow `@istanbuljs/load-nyc-config` override selects the maintained `js-yaml` 4 parser through the loader's supported `load()` API. The harness project tests valid YAML, relative extensions, JSON, CommonJS, parse failures, and executable-tag rejection against that actual dependency. Do not add removed-parser API aliases to make coverage tools appear compatible.

## Running playgrounds

Currently the `React` playground (located in `packages/playground-react`) is a Next.js app that contains some examples which you can find in the `pages` directory. The `Vue` playground (located in `packages/playground-vue`) is a Vite app that contains some examples which you can find in the `src/components` directory.

You can launch them by running:

```sh
npm run react playground

# or

npm run vue playground
```

This will also start the necessary watchers so that you don't have to care about them.

## Scripts summary

Global scripts, and some aliases:

- `npm install`: install all dependencies for all packages
- `npm run clean`: this will call all `npm run {package} clean` commands
- `npm run build`: this will call all `npm run {package} build` commands
- `npm run lint`: this will `lint` all packages
- `npm run test`: this will `test` all packages
  - `npm run test`: run all jest tests
  - `npm run test --watch`: run all jest tests in interactive mode
  - `npm run test tabs`: run all jest tests filtered by `tabs`
  - `npm run test tabs --watch`: run all jest tests in interactive mode filtered by `tabs`

Scripts per package:

- `npm run react`: Prefix to run anything in the `@headlessui/react` package
  - `npm run react test`: run all jest tests
  - `npm run react test --watch`: run all jest tests in interactive mode
  - `npm run react test tabs`: run all jest tests filtered by `tabs`
  - `npm run react test tabs --watch`: run all jest tests in interactive mode filtered by `tabs`
  - `npm run react build`: build the final artefacts
  - `npm run react lint`: validate and fix the react codebase using prettier
  - `npm run react watch`: start a watcher for the react esm build
    - **Note**: this will be executed for you when using the `npm run react playground`
    - **Note**: this is not required for jest. You will probably never need this
  - `npm run react playground`: (alias) start a development server in the `playground-react` package
    - **Note**: this will also run `npm run react watch` for you, which means that you only need to execute `npm run react playground`
  - `npm run react clean`: this will remove `dist` files
- `npm run vue`: Prefix to run anything in the `@headlessui/vue` package
  - `npm run vue test`: run all jest tests
  - `npm run vue test --watch`: run all jest tests in interactive mode
  - `npm run vue test tabs`: run all jest tests filtered by `tabs`
  - `npm run vue test tabs --watch`: run all jest tests in interactive mode filtered by `tabs`
  - `npm run vue build`: build the final artefacts
  - `npm run vue lint`: validate and fix the vue codebase using prettier
  - `npm run vue watch`: start a watcher for the vue esm build
    - **Note**: this will be executed for you when using the `npm run vue playground`
    - **Note**: this is not required for jest. You will probably never need this
  - `npm run vue playground`: (alias) start a development server in the `playground-vue` package
    - **Note**: this will also run `npm run vue watch` for you, which means that you only need to execute `npm run react playground`
  - `npm run vue clean`: this will remove `dist` files
