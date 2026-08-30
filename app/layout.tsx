import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZenTec Gateway",
  description: "ZenTec Gateway — secure Billplz FPX checkout",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ms">
      <body>{children}</body>
    </html>
  );
}
