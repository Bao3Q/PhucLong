import type { MetadataRoute } from "next";

/**
 * Web App Manifest (NFR-03 – PWA): Next.js phục vụ tại /manifest.webmanifest
 * và tự chèn <link rel="manifest"> vào <head>. Cho phép "Thêm vào màn hình chính"
 * trên điện thoại, mở ở chế độ standalone như một ứng dụng.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Phúc Long Coffee & Tea - BrewLite",
    short_name: "Phúc Long",
    description: "Đặt trà và cà phê Phúc Long trực tuyến",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F6F2",
    theme_color: "#006A32",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
