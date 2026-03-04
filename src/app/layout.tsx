import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Patronage — Art Grants & Opportunities for NZ & Australian Artists",
    template: "%s | Patronage",
  },
  description:
    "Find art grants, residencies, commissions, and open calls for New Zealand and Australian artists. Patronage curates the best arts funding opportunities in NZ and Australia.",
  keywords: [
    "art grants NZ",
    "art grants New Zealand",
    "art grants Australia",
    "arts funding New Zealand",
    "arts funding Australia",
    "artist grants",
    "residencies New Zealand",
    "open calls artists",
    "arts council grants",
    "Creative NZ grants",
    "Australia Council grants",
  ],
  icons: { icon: "/Favicon.png" },
  verification: { google: "b1uNttMPg-mggBe-7YRYuCrdH_qyy0fWGTdCQX3fY30" },
  metadataBase: new URL("https://patronage.nz"),
  openGraph: {
    siteName: "Patronage",
    type: "website",
    locale: "en_NZ",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {modal}
        <Toaster position="bottom-center" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
