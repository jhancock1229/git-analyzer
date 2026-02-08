module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/server.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
