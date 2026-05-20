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
  title: "World Cup 2026 Match Picks · USA · Canada · Mexico",
  description:
    "Compare our World Cup 2026 win estimates to betting odds. " +
    "See when the market might be too high or too low on a team.",
  applicationName: "WC26 Match Picks",
  keywords: [
    "World Cup 2026",
    "FIFA",
    "Polymarket",
    "soccer",
    "football",
    "betting odds",
    "win probability",
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
