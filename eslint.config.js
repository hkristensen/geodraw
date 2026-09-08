import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'functions/lib'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The codebase leans on `any` at GeoJSON/turf and Firebase payload
      // boundaries throughout - not something to fix via a blanket lint
      // rule right now. Keep it a warning so new, unrelated `any`s are at
      // least visible without failing the whole build on day one.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // territoryUtils.ts (and friends) lean on multi-strategy fallback
      // chains - try A, if it throws silently fall through to try B - where
      // an empty catch is the intended behavior, not a mistake. Every other
      // empty block (not a catch) still errors.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
)
