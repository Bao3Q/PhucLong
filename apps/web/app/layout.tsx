import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Phúc Long Coffee & Tea - BrewLite",
  description: "Trải nghiệm đặt trà và cà phê trực tuyến hiện đại",
  applicationName: "Phúc Long",
  appleWebApp: {
    capable: true,
    title: "Phúc Long",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

// Mobile-first (NFR-03): màu thanh trạng thái trùng màu thương hiệu.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006A32",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
