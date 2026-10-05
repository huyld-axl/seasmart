const eslintPluginImport = require('eslint-plugin-import')
const eslintPluginN = require('eslint-plugin-n')
const eslintPluginPromise = require('eslint-plugin-promise')
const globals = require('globals')

module.exports = [
  {
    ignores: ['node_modules/**', '**/__tests__/**', '**/*.test.js'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      import: eslintPluginImport,
      n: eslintPluginN,
      promise: eslintPluginPromise,
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
]
