module.exports = {
  coverageProvider: 'v8',
  projects: [
    '<rootDir>/packages/*/jest.config.cjs',
    {
      displayName: 'Harness',
      testEnvironment: 'node',
      roots: ['<rootDir>/jest'],
      testMatch: ['<rootDir>/jest/**/*.test.cjs'],
    },
  ],
}
