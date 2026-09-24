// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  // Acessibilidade é requisito (WCAG 2.2 AA), não recomendação.
  jsxA11y.flatConfigs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // Provedores exportam o componente e o hook de consumo juntos, de propósito.
      // Provedores exportam o hook de consumo junto; componentes de UI exportam a
      // função de estilo e as constantes que os descrevem. Nomeados um a um.
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: ['useConfirmacao', 'estilosDeBotao', 'REQUISITOS_DA_SENHA', 'senhaAtendeRequisitos', 'GESTOS'],
        },
      ],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    files: ['src/app/router/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**/*.ts'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off', '@typescript-eslint/unbound-method': 'off' },
  },
);
