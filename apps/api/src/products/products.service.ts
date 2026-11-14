import { Injectable, NotFoundException } from '@nestjs/common';
import { Product, ProductOption, SEED_PRODUCTS } from './products.data';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** Gán id tăng dần cho danh sách size / topping mới. */
function withIds(options: { name: string; price: number }[] = []): ProductOption[] {
  return options.map((o, i) => ({ id: i + 1, name: o.name, price: o.price }));
}

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

  /** ADMIN: thêm sản phẩm mới. */
  async create(dto: CreateProductDto): Promise<Product> {
    const nextId = this.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const product: Product = {
      id: nextId,
      name: dto.name,
      category: dto.category,
      basePrice: dto.basePrice,
      description: dto.description ?? '',
      image: dto.image,
      tag: dto.tag ?? null,
      sizes: withIds(dto.sizes),
      toppings: withIds(dto.toppings),
    };
    this.products = [...this.products, product];
    return product;
  }

  /** ADMIN: sửa một phần sản phẩm. */
  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const current = await this.findOne(id);
    const updated: Product = {
      ...current,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.image !== undefined && { image: dto.image }),
      ...(dto.tag !== undefined && { tag: dto.tag }),
      ...(dto.sizes !== undefined && { sizes: withIds(dto.sizes) }),
      ...(dto.toppings !== undefined && { toppings: withIds(dto.toppings) }),
    };
    this.products = this.products.map((p) => (p.id === id ? updated : p));
    return updated;
  }
}
