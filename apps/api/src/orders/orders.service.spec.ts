import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an order and calculate totalAmount accurately', async () => {
    const items = [
      {
        productId: 1,
        productName: 'Trà Sữa Phúc Long',
        size: 'M' as const,
        quantity: 2,
        unitPrice: 50000,
      },
      {
        productId: 2,
        productName: 'Trà Đào Trầm Hương',
        size: 'L' as const,
        quantity: 1,
        unitPrice: 65000,
      },
    ];

    const order = await service.createOrder(items);

    expect(order).toBeDefined();
    expect(order.id).toMatch(/^ORD-\d+/);
    expect(order.items.length).toBe(2);
    expect(order.totalAmount).toBe(165000); // (50000 * 2) + (65000 * 1) = 165000
    expect(order.status).toBe('PENDING_PAYMENT');
  });

  it('should find an existing order by ID', async () => {
    const created = await service.createOrder([
      {
        productId: 3,
        productName: 'Cà Phê Sữa Đá',
        size: 'S' as const,
        quantity: 1,
        unitPrice: 35000,
      },
    ]);

    const found = await service.findOne(created.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(created.id);
    expect(found.totalAmount).toBe(35000);
  });

  it('should throw NotFoundException if order does not exist', async () => {
    await expect(service.findOne('ORD-NON-EXISTING')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update order status correctly', async () => {
    const created = await service.createOrder([
      {
        productId: 1,
        productName: 'Trà Sữa',
        size: 'S' as const,
        quantity: 1,
        unitPrice: 45000,
      },
    ]);

    const updated = await service.updateStatus(created.id, 'PAID');
    expect(updated.status).toBe('PAID');

    const verified = await service.findOne(created.id);
    expect(verified.status).toBe('PAID');
  });
});
