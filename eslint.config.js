import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      '.vercel/**',
      '.claude/**', // agent worktrees + skills, not this project's source
      'runs/**',
      // Admin-panel-generated data modules: multi-hundred-KB literals, not hand-written code
      'src/data/admin-products.js',
      'src/data/admin-collections.js',
    ],
  },

  // Browser code: the Vite/React SPA
  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The codebase uses the automatic JSX runtime and doesn't ship prop-types.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Copy is full of apostrophes; escaping them would hurt readability for no gain.
      'react/no-unescaped-entities': 'off',
      // Deliberate throughout: best-effort calls (analytics, clipboard) that must never throw.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Pre-existing dead bindings — surfaced, not blocking, until they're cleaned up.
      'no-unused-vars': ['warn', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },

  // Server code: Vercel serverless functions + build scripts
  {
    files: ['api/**/*.js', 'scripts/**/*.js', '*.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
]
