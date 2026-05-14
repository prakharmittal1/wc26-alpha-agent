import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WC26 Alpha Agent · USA · Canada · Mexico",
  description:
    "Find mispriced FIFA World Cup 2026 contracts on Polymarket. " +
    "An autonomous agent compares true probabilities against live markets " +
    "across the road to the USA / Canada / Mexico tournament.",
  applicationName: "WC26 Alpha Agent",
  keywords: [
    "World Cup 2026",
    "FIFA",
    "Polymarket",
    "soccer",
    "football",
    "alpha",
    "prediction market",
    "Gemini",
  ],
};

export const viewport: Viewport = {
  themeColor: "#ec1163",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
