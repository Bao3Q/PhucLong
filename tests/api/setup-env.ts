/**
 * Chạy trước mỗi file integration test.
 * Jest tự đặt NODE_ENV=test, mà PrismaModule trả về null khi NODE_ENV=test
 * (để unit test chạy in-memory). Integration test cần PostgreSQL thật nên đổi
 * sang "integration".
 */
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'test') {
  process.env.NODE_ENV = 'integration';
}
process.env.JWT_SECRET ??= 'integration-test-secret';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Integration test cần DATABASE_URL tới PostgreSQL đã chạy migration. ' +
      'Ví dụ: docker compose up -d postgres rồi đặt ' +
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5433/phuclong_db?schema=public',
  );
}
