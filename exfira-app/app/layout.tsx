import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["300","400","500","600"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["400","500","600","700","800"] });

export const metadata: Metadata = {
  title: "Exfira — Private AI",
  description: "AI that never sees your data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="h-full"><Providers>{children}</Providers></body>
    </html>
  );
}
