import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
{ ignores: ['node_modules/**', '.next/**', 'dist/**', 'supabase/**', 'tests/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Global rule adjustments
  {
    rules: {
      'no-undef': 'off',
      // Prefer TS rule for unused vars
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Tweak noisy rules
'prefer-const': 'off',
    },
  },
  // Language options
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
]
