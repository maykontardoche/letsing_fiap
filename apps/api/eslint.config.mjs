// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

/** Os módulos de negócio. Usado abaixo para impedir que um importe do irmão. */
const MODULOS = [
  'autenticacao',
  'me',
  'documentos',
  'assinatura',
  'validacao',
  'painel',
  'equipe',
  'auditoria',
  'organizacao',
  'tarefas',
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'storage/**', '*.config.mjs', '*.config.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Prettier com largura 100 — as linhas longas de template (e-mail, PDF) ficam como estão.
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // O Nest usa classes com decorators e métodos assíncronos sem `await` explícito em
      // alguns handlers de controller; o retorno da promise é o que importa.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // A fronteira entre módulos, garantida por ferramenta e não por convenção:
    // o que dois módulos precisam sobe para `common/`.
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: MODULOS.map((modulo) => `../${modulo}/**`),
              message: 'Módulo não importa de módulo irmão. O que os dois precisam sobe para common/.',
            },
          ],
        },
      ],
    },
  },
  {
    // ⚠️ `process.env` só em `config/env/`: o contrato de configuração mora num
    // lugar só, validado no boot.
    files: ['src/**/*.ts'],
    ignores: ['src/config/env/**/*.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Leia a configuração pelo EnvService (src/config/env/).' },
      ],
    },
  },
  {
    // Testes e scripts descrevem cenários: `supertest` devolve `any` no `body`.
    files: ['**/*.spec.ts', 'test/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
