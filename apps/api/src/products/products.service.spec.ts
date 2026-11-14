import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all products when no category is specified', async () => {
    const products = await service.findAll();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('name');
    expect(products[0]).toHaveProperty('basePrice');
    expect(products[0]).toHaveProperty('stock');
  });

  it('should return products filtered by category', async () => {
    const products = await service.findAll('Cà Phê');
    expect(products.length).toBeGreaterThan(0);
    products.forEach((p) => {
      expect(p.category.toLowerCase()).toBe('cà phê');
    });
  });

  it('should return a specific product by ID (id dạng string khớp DB)', async () => {
    const product = await service.findOne('1');
    expect(product).toBeDefined();
    expect(product.id).toBe('1');
  });

  it('should throw NotFoundException if product is not found', async () => {
    await expect(service.findOne('999999')).rejects.toThrow(NotFoundException);
  });

  it('findOneFromStorage trả giá/tồn kho để orders tính tiền', async () => {
    const view = await service.findOneFromStorage('1');
    expect(view).toMatchObject({ id: '1', name: 'Cappuccino Espresso', price: 45000, stock: 50 });
    expect(await service.findOneFromStorage('khong-ton-tai')).toBeUndefined();
  });

  it('ADMIN thêm sản phẩm mới có tồn kho', async () => {
    const created = await service.create({
      name: 'Trà Đào Test',
      category: 'Trà Trái Cây',
      basePrice: 39000,
      image: 'https://example.com/tra-dao.jpg',
      stock: 10,
    });
    expect(created.stock).toBe(10);
    const found = await service.findOne(created.id);
    expect(found.name).toBe('Trà Đào Test');
  });

  describe('tồn kho nhánh in-memory (mutex + hoàn tác)', () => {
    it('trừ stock thành công khi đủ hàng', async () => {
      const result = await service.withStockReservation(
        [{ productId: '1', qty: 2 }],
        async () => 'ok',
      );
      expect(result).toBe('ok');
      expect((await service.findOneFromStorage('1'))?.stock).toBe(48);
    });

    it('từ chối khi không đủ hàng và không đổi stock', async () => {
      await expect(
        service.withStockReservation([{ productId: '1', qty: 9999 }], async () => 'ok'),
      ).rejects.toThrow(BadRequestException);
      expect((await service.findOneFromStorage('1'))?.stock).toBe(50);
    });

    it('hoàn tác stock khi operation thất bại', async () => {
      await expect(
        service.withStockReservation([{ productId: '1', qty: 2 }], async () => {
          throw new Error('storage failure');
        }),
      ).rejects.toThrow('storage failure');
      expect((await service.findOneFromStorage('1'))?.stock).toBe(50);
    });

    it('withStockRestoration cộng lại stock', async () => {
      await service.withStockReservation([{ productId: '1', qty: 2 }], async () => 'ok');
      await service.withStockRestoration([{ productId: '1', qty: 2 }], async () => 'ok');
      expect((await service.findOneFromStorage('1'))?.stock).toBe(50);
    });
  });
});
