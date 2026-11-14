import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import {
  DEFAULT_SIZES,
  DEFAULT_TOPPINGS,
  Product,
  SEED_PRODUCTS,
} from './products.data';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

/** Dạng rút gọn dùng để tính giá / trừ tồn kho (cả DB lẫn in-memory đều trả được). */
export interface ProductStockView {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface StockRequest {
  productId: string;
  qty: number;
}

@Injectable()
export class ProductsService implements OnModuleInit {
  /** Hàng đợi tuần tự hóa các thao tác tồn kho trên nhánh in-memory. */
  private stockQueue: Promise<void> = Promise.resolve();

  /**
   * Nhánh in-memory (dùng khi không có PrismaService — unit test).
   * Copy sâu seed: mỗi instance có object riêng, stock mutate ở một instance
   * không lọt sang instance khác (các element của SEED_PRODUCTS được bảo vệ).
   */
  private products: Product[] = SEED_PRODUCTS.map((p) => ({
    ...p,
    sizes: p.sizes.map((s) => ({ ...s })),
    toppings: p.toppings.map((t) => ({ ...t })),
  }));

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  /** Seed 4 sản phẩm mẫu vào DB lúc khởi động (không đụng stock khi đã có). */
  async onModuleInit(): Promise<void> {
    if (!this.prisma) return;

    for (const product of this.products) {
      await this.prisma.product.upsert({
        where: { id: product.id },
        create: {
          id: product.id,
          name: product.name,
          price: product.basePrice,
          imageUrl: product.image,
          description: product.description,
          tag: product.tag ?? null,
          category: product.category,
          stock: product.stock,
        },
        update: {
          name: product.name,
          price: product.basePrice,
          imageUrl: product.image,
          description: product.description,
          tag: product.tag ?? null,
          category: product.category,
        },
      });
    }
  }

  /** Map row PostgreSQL → shape API mà frontend đang dùng. */
  private toApiProduct(row: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    description?: string | null;
    tag?: string | null;
    category?: string | null;
    stock: number;
  }): Product {
    return {
      id: row.id,
      name: row.name,
      category: row.category ?? 'Khác',
      basePrice: row.price,
      description: row.description ?? '',
      image: row.imageUrl,
      tag: row.tag ?? null,
      stock: row.stock,
      sizes: DEFAULT_SIZES.map((s) => ({ ...s })),
      toppings: DEFAULT_TOPPINGS.map((t) => ({ ...t })),
    };
  }

  // Xem danh sách sản phẩm (lọc theo category nếu có).
  async findAll(category?: string): Promise<Product[]> {
    if (this.prisma) {
      const rows = await this.prisma.product.findMany({
        orderBy: { id: 'asc' },
      });
      const products = rows.map((row) => this.toApiProduct(row));
      if (category && category !== 'Tất cả') {
        return products.filter(
          (p) => p.category.toLowerCase() === category.toLowerCase(),
        );
      }
      return products;
    }

    if (category && category !== 'Tất cả') {
      return this.products.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase(),
      );
    }
    return this.products.map((p) => ({ ...p, sizes: [...p.sizes], toppings: [...p.toppings] }));
  }

  // Xem chi tiết sản phẩm.
  async findOne(id: string): Promise<Product> {
    if (this.prisma) {
      const row = await this.prisma.product.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
      }
      return this.toApiProduct(row);
    }
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
    }
    return { ...product, sizes: [...product.sizes], toppings: [...product.toppings] };
  }

  /** Tra sản phẩm để tính giá / kiểm tra tồn kho — không throw, trả undefined nếu thiếu. */
  async findOneFromStorage(id: string): Promise<ProductStockView | undefined> {
    if (this.prisma) {
      const row = await this.prisma.product.findUnique({ where: { id } });
      return row
        ? { id: row.id, name: row.name, price: row.price, stock: row.stock }
        : undefined;
    }
    const product = this.products.find((p) => p.id === id);
    return product
      ? { id: product.id, name: product.name, price: product.basePrice, stock: product.stock }
      : undefined;
  }

  // ADMIN: thêm sản phẩm mới.
  async create(dto: CreateProductDto): Promise<Product> {
    if (this.prisma) {
      const row = await this.prisma.product.create({
        data: {
          name: dto.name,
          price: dto.basePrice,
          imageUrl: dto.image,
          description: dto.description ?? null,
          tag: dto.tag ?? null,
          category: dto.category,
          stock: dto.stock ?? 0,
        },
      });
      return this.toApiProduct(row);
    }

    const nextId =
      this.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const product: Product = {
      id: String(nextId),
      name: dto.name,
      category: dto.category,
      basePrice: dto.basePrice,
      description: dto.description ?? '',
      image: dto.image,
      tag: dto.tag ?? null,
      stock: dto.stock ?? 0,
      sizes: DEFAULT_SIZES.map((s) => ({ ...s })),
      toppings: DEFAULT_TOPPINGS.map((t) => ({ ...t })),
    };
    this.products = [...this.products, product];
    return { ...product, sizes: [...product.sizes], toppings: [...product.toppings] };
  }

  // ADMIN: sửa một phần sản phẩm.
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const data = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.basePrice !== undefined && { price: dto.basePrice }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.image !== undefined && { imageUrl: dto.image }),
      ...(dto.tag !== undefined && { tag: dto.tag }),
      ...(dto.stock !== undefined && { stock: dto.stock }),
    };

    if (this.prisma) {
      try {
        const row = await this.prisma.product.update({ where: { id }, data });
        return this.toApiProduct(row);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
        }
        throw error;
      }
    }

    const current = this.products.find((p) => p.id === id);
    if (!current) {
      throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
    }
    const updated: Product = {
      ...current,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.image !== undefined && { image: dto.image }),
      ...(dto.tag !== undefined && { tag: dto.tag }),
      ...(dto.stock !== undefined && { stock: dto.stock }),
    };
    this.products = this.products.map((p) => (p.id === id ? updated : p));
    return { ...updated, sizes: [...updated.sizes], toppings: [...updated.toppings] };
  }

  // ==================== Tồn kho (nhánh in-memory) ====================

  /** Trừ tồn kho trong bộ nhớ — chỉ dùng khi không có DB. */
  private deductStock(productId: string, qty: number): void {
    const product = this.products.find((item) => item.id === productId);
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${productId} không tồn tại`);
    }
    if (!Number.isSafeInteger(qty) || qty <= 0) {
      throw new BadRequestException('Số lượng đặt phải là số nguyên dương');
    }
    if (product.stock < qty) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
      );
    }
    product.stock -= qty;
  }

  /** Đặt trước tồn kho, chạy `operation` rồi tự hoàn nếu operation thất bại. */
  withStockReservation<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(requests, 'reserve', operation);
  }

  /** Hoàn trả tồn kho (hủy đơn), chạy `operation` rồi tự trừ lại nếu thất bại. */
  withStockRestoration<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(requests, 'restore', operation);
  }

  /**
   * Tuần tự hóa thao tác tồn kho bằng promise-chain mutex: các request chồng
   * nhau xếp hàng đợi, trong thao tác có hoàn tác (compensating rollback).
   */
  private withStockTransaction<T>(
    requests: StockRequest[],
    operationType: 'reserve' | 'restore',
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.stockQueue;
    let release!: () => void;
    this.stockQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(() =>
      this.applyStockTransaction(requests, operationType, operation).finally(release),
    );
  }

  private async applyStockTransaction<T>(
    requests: StockRequest[],
    operationType: 'reserve' | 'restore',
    operation: () => Promise<T>,
  ): Promise<T> {
    const quantities = new Map<string, number>();
    for (const { productId, qty } of requests) {
      if (!productId || !Number.isSafeInteger(qty) || qty <= 0) {
        throw new BadRequestException('Sản phẩm và số lượng đặt không hợp lệ');
      }
      const totalQty = (quantities.get(productId) ?? 0) + qty;
      if (!Number.isSafeInteger(totalQty)) {
        throw new BadRequestException('Tổng số lượng sản phẩm không hợp lệ');
      }
      quantities.set(productId, totalQty);
    }

    // Kiểm tra đủ điều kiện trước khi đụng vào stock.
    for (const [productId, qty] of quantities) {
      const product = this.products.find((item) => item.id === productId);
      if (!product) {
        throw new NotFoundException(`Sản phẩm với ID ${productId} không tồn tại`);
      }
      if (operationType === 'reserve' && product.stock < qty) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
        );
      }
      if (operationType === 'restore' && !Number.isSafeInteger(product.stock + qty)) {
        throw new BadRequestException('Số lượng tồn kho sau khi hoàn không hợp lệ');
      }
    }

    const changedProductIds: string[] = [];
    try {
      for (const [productId, qty] of quantities) {
        if (operationType === 'reserve') {
          this.deductStock(productId, qty);
        } else {
          const product = this.products.find((item) => item.id === productId)!;
          product.stock += qty;
        }
        changedProductIds.push(productId);
      }
      return await operation();
    } catch (error) {
      // Hoàn tác những thay đổi đã thực hiện để stock luôn nhất quán.
      for (const productId of changedProductIds) {
        const product = this.products.find((item) => item.id === productId);
        if (product) {
          const qty = quantities.get(productId)!;
          product.stock += operationType === 'reserve' ? qty : -qty;
        }
      }
      throw error;
    }
  }

  /** Thiết lập tồn kho trong unit test (nhánh in-memory). */
  setStockForTest(productId: string, stock: number): void {
    const product = this.products.find((item) => item.id === productId);
    if (product) {
      product.stock = stock;
    }
  }
}
