import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output, and the Deno Edge Function (TypeScript, linted by Deno).
  globalIgnores(['dist', 'dist-electron', '.vercel', 'supabase/functions']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // __COMMIT_HASH__ is inlined by Vite (see vite.config.js)
      globals: { ...globals.browser, __COMMIT_HASH__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Web Workers
    files: ['src/**/*.worker.js'],
    languageOptions: { globals: globals.worker },
  },
  {
    // Node: config files, build scripts and the Electron main process
    files: ['*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs}', 'electron/**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['electron/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
])
