import js from '@eslint/js';

export default [
  //Can this linter shut the fuck up about the research prototypes
  {
    ignores: ['docs/research/**']
  },
  
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

  // Jest test files
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        test: 'readonly',
      }
    }
  }
];