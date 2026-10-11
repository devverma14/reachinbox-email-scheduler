module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
