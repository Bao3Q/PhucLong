import { Injectable, NotFoundException } from '@nestjs/common';
import { Product, SEED_PRODUCTS } from './products.data';

@Injectable()
export class ProductsService {
  private products: Product[] = [...SEED_PRODUCTS];

  async findAll(category?: string): Promise<Product[]> {
    if (category && category !== 'Tất cả') {
      return this.products.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase(),
      );
    }
    return this.products;
  }

  async findOne(id: number): Promise<Product> {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }
}
