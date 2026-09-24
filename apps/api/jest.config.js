/**
 * Unidade e integração rodam na mesma suíte, distinguidas pelo sufixo do
 * arquivo: `*.spec.ts` para unidade e `*.integration.spec.ts` para integração
 * (sobe a aplicação inteira e fala com Postgres e Redis de verdade).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // Roda antes de qualquer módulo ser importado — o ConfigModule valida no import.
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Cria o banco de teste e aplica as migrations antes de tudo.
  globalSetup: '<rootDir>/test/global-setup.ts',
  // As suítes de integração sobem Nest + Prisma + Redis no `beforeAll`.
  testTimeout: 30000,
  // Integração compartilha banco: em série é determinístico.
  maxWorkers: 1,
};
