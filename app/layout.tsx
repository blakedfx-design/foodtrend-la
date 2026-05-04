import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-food-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-food-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Foodtrend LA",
  description:
    "What's trending on LA menus right now—food, drinks, and desserts—and the spots surfacing it first.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
