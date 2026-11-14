export interface ProductOption {
  id: number;
  name: string;
  price: number;
}

/**
 * Shape API trả cho frontend (menu, chi tiết sản phẩm).
 * id là string để khớp với cột `Product.id` trong PostgreSQL.
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
  stock: number;
  sizes: ProductOption[];
  toppings: ProductOption[];
}

/** Phụ phí size — nguồn chuẩn cho cả hiển thị lẫn tính tiền phía server. */
export const SIZE_SURCHARGE: Record<string, number> = {
  S: 0,
  M: 5000,
  L: 10000,
};

/** Bảng giá topping theo tên — orders.service tra bảng này để tính giá. */
export const TOPPINGS: Record<string, number> = {
  'Shot Espresso thêm': 15000,
};

/** Danh sách size mặc định trả về cho mọi sản phẩm. */
export const DEFAULT_SIZES: ProductOption[] = [
  { id: 1, name: 'Size S', price: SIZE_SURCHARGE.S },
  { id: 2, name: 'Size M (+5k)', price: SIZE_SURCHARGE.M },
  { id: 3, name: 'Size L (+10k)', price: SIZE_SURCHARGE.L },
];

/** Danh sách topping mặc định trả về cho mọi sản phẩm. */
export const DEFAULT_TOPPINGS: ProductOption[] = Object.entries(TOPPINGS).map(
  ([name, price], i) => ({ id: i + 1, name, price }),
);

export const SEED_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Cappuccino Espresso',
    category: 'Cà Phê',
    basePrice: 45000,
    description: 'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
    tag: 'BÁN CHẠY',
    stock: 50,
    sizes: DEFAULT_SIZES,
    toppings: DEFAULT_TOPPINGS,
  },
  {
    id: '2',
    name: 'Bạc Xỉu',
    category: 'Cà Phê',
    basePrice: 40000,
    description: 'Nhiều sữa, ít cà phê — ngọt béo nhẹ nhàng, đậm chất Sài Gòn xưa.',
    image: 'https://lypham.vn/wp-content/uploads/2024/09/cach-lam-bac-xiu-da.jpg?w=500&auto=format&fit=crop&q=60',
    tag: null,
    stock: 40,
    sizes: DEFAULT_SIZES,
    toppings: DEFAULT_TOPPINGS,
  },
  {
    id: '3',
    name: 'Cà Phê Sữa Đá',
    category: 'Cà Phê',
    basePrice: 35000,
    description: 'Hạt Robusta đậm đà rang mộc hòa quyện cùng sữa đặc truyền thống.',
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
    tag: null,
    stock: 30,
    sizes: DEFAULT_SIZES,
    toppings: DEFAULT_TOPPINGS,
  },
  {
    id: '4',
    name: 'Cà Phê Đen',
    category: 'Cà Phê',
    basePrice: 30000,
    description: 'Robusta rang mộc pha phin truyền thống, đậm đà thuần khiết.',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVqi4ea6-SWob0t9eE6zuOSGIf6-ciRZHjw4Bm2BZ-3l8uVsOG9VAXaMk&s=10',
    tag: null,
    stock: 25,
    sizes: DEFAULT_SIZES,
    toppings: DEFAULT_TOPPINGS,
  },
];
