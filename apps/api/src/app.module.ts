import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { InventoryController } from './inventory/inventory.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrismaModule, AuthModule, ProductsModule, OrdersModule, PaymentsModule],
  controllers: [InventoryController, HealthController],
})
export class AppModule {}
