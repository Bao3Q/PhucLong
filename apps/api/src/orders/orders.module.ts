import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrderExpiryService } from './order-expiry.service';

@Module({
  imports: [ProductsModule, PromotionsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderExpiryService],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
