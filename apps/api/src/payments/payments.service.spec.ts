import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let paymentsService: PaymentsService;
  let ordersService: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService, OrdersService],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(paymentsService).toBeDefined();
  });

  it('should process payment successfully and update order to PAID', async () => {
    const order = await ordersService.createOrder([
      {
        productId: 1,
        productName: 'Trà Sữa Phúc Long',
        size: 'M',
        quantity: 2,
        unitPrice: 50000,
      },
    ]);

    const payment = await paymentsService.processPayment(order.id, 'momo');
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.amount).toBe(100000);

    const updatedOrder = await ordersService.findOne(order.id);
    expect(updatedOrder.status).toBe('PAID');
  });

  it('should handle idempotency: return previous payment result without re-processing', async () => {
    const order = await ordersService.createOrder([
      {
        productId: 2,
        productName: 'Trà Đào Trầm Hương',
        size: 'L',
        quantity: 1,
        unitPrice: 65000,
      },
    ]);

    const idempotencyKey = 'IDEM-TEST-12345';


    const payment1 = await paymentsService.processPayment(
      order.id,
      'card',
      idempotencyKey,
    );


    const payment2 = await paymentsService.processPayment(
      order.id,
      'card',
      idempotencyKey,
    );

    expect(payment1.id).toBe(payment2.id);
    expect(payment1.transactionId).toBe(payment2.transactionId);
  });

  it('should throw BadRequestException if order is already PAID without same idempotency key', async () => {
    const order = await ordersService.createOrder([
      {
        productId: 3,
        productName: 'Cà Phê Sữa Đá',
        size: 'S',
        quantity: 1,
        unitPrice: 35000,
      },
    ]);

    await paymentsService.processPayment(order.id, 'momo');


    await expect(
      paymentsService.processPayment(order.id, 'card', 'ANOTHER-KEY'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if order does not exist', async () => {
    await expect(
      paymentsService.processPayment('NON_EXISTING_ORDER', 'momo'),
    ).rejects.toThrow(NotFoundException);
  });
});
