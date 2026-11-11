import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { NotFoundException } from '@nestjs/common';

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
  });

  it('should return products filtered by category', async () => {
    const products = await service.findAll('Cà Phê');
    expect(products.length).toBeGreaterThan(0);
    products.forEach((p) => {
      expect(p.category.toLowerCase()).toBe('cà phê');
    });
  });

  it('should return a specific product by ID', async () => {
    const product = await service.findOne(1);
    expect(product).toBeDefined();
    expect(product.id).toBe(1);
  });

  it('should throw NotFoundException if product is not found', async () => {
    await expect(service.findOne(999999)).rejects.toThrow(NotFoundException);
  });
});
