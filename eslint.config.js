import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
];