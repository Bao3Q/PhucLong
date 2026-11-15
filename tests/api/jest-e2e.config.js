/**
 * Jest config cho integration test API (INT-T*) — chạy bằng HTTP thật (supertest)
 * trên toàn bộ AppModule với PostgreSQL thật.
 *
 *   docker compose up -d postgres           # hoặc service postgres của CI
 *   cd apps/api && npx prisma migrate deploy
 *   npm --prefix apps/api run test:e2e
 *
 * Dependency (jest, ts-jest, supertest, @nestjs/testing) lấy từ node_modules của
 * monorepo (npm workspaces hoist lên thư mục gốc) — không cần cài thêm gì.
 */
const path = require('path');

const apiDir = path.join(__dirname, '../../apps/api');

module.exports = {
  rootDir: __dirname,
  testRegex: '.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': [
      require.resolve('ts-jest', { paths: [apiDir] }),
      { tsconfig: path.join(__dirname, 'tsconfig.json') },
    ],
  },
  // tests/ nằm ngoài apps/api: chỉ thêm đường tìm module, không đổi cách resolve khác.
  modulePaths: [path.join(apiDir, 'node_modules'), path.join(__dirname, '../../node_modules')],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/setup-env.ts'],
  testTimeout: 30000,
};
