import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import MaintenanceGate from "@/components/maintenance/MaintenanceGate";
import { TooltipProvider } from "@/components/ui/tooltip";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DigiMarket — Produk Digital & Social Growth",
  description: "Marketplace produk digital, lisensi, tools, akses siap pakai, dan layanan social growth dengan checkout cepat dan wallet DigiMarket.",
  icons: {
    icon: [
      { url: "/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} antialiased`}>
      <body className="min-h-screen bg-[#F7F7F5] font-[family-name:var(--font-jakarta)] text-[#141414]">
        <TooltipProvider>
          <Providers>
            <MaintenanceGate>{children}</MaintenanceGate>
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
