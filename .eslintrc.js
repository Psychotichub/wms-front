module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  plugins: ['expo'],
  env: {
    es2021: true,
    node: true,
    browser: true
  },
  globals: {
    __DEV__: 'readonly',
    AbortController: 'readonly'
  },
  rules: {
    // Avoid false positives with some Expo/RN module export shapes.
    'import/namespace': 'off'
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.js', '**/*.test.jsx', 'jest.setup.js'],
      env: {
        jest: true
      },
      rules: {
        'import/no-unresolved': 'off'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'android/',
    'ios/',
    'web-build/',
    'build/',
    'coverage/'
  ]
};
