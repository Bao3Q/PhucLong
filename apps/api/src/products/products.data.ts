export interface ProductOption {
  id: number;
  name: string;
  price: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
  sizes: ProductOption[];
  toppings: ProductOption[];
}

export const SEED_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Trà Sữa Phúc Long',
    category: 'Trà Sữa',
    basePrice: 45000,
    description: 'Trà đậm vị truyền thống kết hợp sữa thơm béo đặc trưng của Phúc Long.',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&auto=format&fit=crop&q=60',
    tag: 'BÁN CHẠY',
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [
      { id: 1, name: 'Trân châu đen', price: 10000 },
      { id: 2, name: 'Thạch nha đam', price: 10000 },
      { id: 3, name: 'Thạch vải', price: 12000 },
    ],
  },
  {
    id: 2,
    name: 'Trà Đào Trầm Hương',
    category: 'Trà Trái Cây',
    basePrice: 55000,
    description: 'Đào miếng tươi giòn ngọt, nền trà ô long thanh mát và hương thơm dịu nhẹ.',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop&q=60',
    tag: 'MỚI',
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [
      { id: 1, name: 'Trân châu đen', price: 10000 },
      { id: 4, name: 'Đào miếng thêm', price: 15000 },
    ],
  },
  {
    id: 3,
    name: 'Cà Phê Sữa Đá',
    category: 'Cà Phê',
    basePrice: 35000,
    description: 'Hạt Robusta đậm đà rang mộc hòa quyện cùng sữa đặc truyền thống.',
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
    tag: null,
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
    ],
    toppings: [
      { id: 1, name: 'Trân châu đen', price: 10000 },
      { id: 5, name: 'Shot Espresso thêm', price: 15000 },
    ],
  },
  {
    id: 4,
    name: 'Cappuccino Espresso',
    category: 'Cà Phê',
    basePrice: 45000,
    description: 'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
    tag: null,
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
    ],
    toppings: [],
  },
];
