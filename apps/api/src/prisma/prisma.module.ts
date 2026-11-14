import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Module global: các module khác chỉ cần inject PrismaService.
 * Trong môi trường test (NODE_ENV=test) factory trả về null: mọi
 * repository/service nhận null và tự chuyển sang lưu trữ in-memory,
 * nhờ vậy unit test chạy được mà không cần PostgreSQL.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () =>
        process.env.NODE_ENV === 'test' ? null : new PrismaService(),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
