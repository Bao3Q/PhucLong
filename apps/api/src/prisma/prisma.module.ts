import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Module global: các module khác chỉ cần inject PrismaService. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
