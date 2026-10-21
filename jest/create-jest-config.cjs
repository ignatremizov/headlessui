module.exports = function createJestConfig(root, options) {
  let { setupFilesAfterEnv = [], transform = {}, ...rest } = options
  return Object.assign(
    {
      rootDir: root,
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      snapshotFormat: {
        escapeString: true,
        printBasicPrototype: true,
      },
      fakeTimers: {
        // Preserve the existing interaction helpers' timeout and real rendering-queue semantics.
        doNotFake: [
          'setImmediate',
          'clearImmediate',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'queueMicrotask',
        ],
      },
      setupFilesAfterEnv: [
        '<rootDir>../../jest/custom-matchers.ts',
        '<rootDir>../../jest/polyfills.ts',
        ...setupFilesAfterEnv,
      ],
      transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
        ...transform,
      },
      globals: {
        __DEV__: true,
      },
    },
    rest
  )
}
