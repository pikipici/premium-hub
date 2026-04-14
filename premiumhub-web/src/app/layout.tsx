import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import MaintenanceGate from "@/components/maintenance/MaintenanceGate";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DigiMarket — Akun Premium Terpercaya",
  description: "Marketplace akun premium Netflix, Spotify, Disney+, YouTube Premium, Canva Pro dengan harga terjangkau dan garansi 30 hari.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} antialiased`}>
      <body className="min-h-screen bg-[#F7F7F5] font-[family-name:var(--font-jakarta)] text-[#141414]">
        <Providers>
          <MaintenanceGate>{children}</MaintenanceGate>
        </Providers>
      </body>
    </html>
  );
}
