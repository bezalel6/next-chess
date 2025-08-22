import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
{ ignores: ['node_modules/**', '.next/**', 'dist/**', 'supabase/**', 'tests/**'] },
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
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-img-element': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      'import/no-anonymous-default-export': 'off',
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
