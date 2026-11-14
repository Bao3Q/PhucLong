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
    name: 'Cappuccino Espresso',
    category: 'Cà Phê',
    basePrice: 45000,
    description: 'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
    tag: 'BÁN CHẠY',
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [{ id: 5, name: 'Shot Espresso thêm', price: 15000 }],
  },
  {
    id: 2,
    name: 'Bạc Xỉu',
    category: 'Cà Phê',
    basePrice: 40000,
    description: 'Nhiều sữa, ít cà phê — ngọt béo nhẹ nhàng, đậm chất Sài Gòn xưa.',
    image: 'https://lypham.vn/wp-content/uploads/2024/09/cach-lam-bac-xiu-da.jpg?w=500&auto=format&fit=crop&q=60',
    tag: null,
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [{ id: 5, name: 'Shot Espresso thêm', price: 15000 }],
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
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [{ id: 5, name: 'Shot Espresso thêm', price: 15000 }],
  },
  {
    id: 4,
    name: 'Cà Phê Đen',
    category: 'Cà Phê',
    basePrice: 30000,
    description: 'Robusta rang mộc pha phin truyền thống, đậm đà thuần khiết.',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVqi4ea6-SWob0t9eE6zuOSGIf6-ciRZHjw4Bm2BZ-3l8uVsOG9VAXaMk&s=10',
    tag: null,
    sizes: [
      { id: 1, name: 'Size S', price: 0 },
      { id: 2, name: 'Size M (+5k)', price: 5000 },
      { id: 3, name: 'Size L (+10k)', price: 10000 },
    ],
    toppings: [{ id: 5, name: 'Shot Espresso thêm', price: 15000 }],
  },
];
