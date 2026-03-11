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

const TITLE = "Patronage — Professional Infrastructure for Artists";
const DESCRIPTION =
  "A free e-portfolio and opportunity directory for NZ and Australian artists. Manage your CV, portfolio, and discover grants, jobs, and residencies in one place.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s | Patronage",
  },
  description: DESCRIPTION,
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
    "artist portfolio",
    "artist CV",
    "artist directory New Zealand",
  ],
  verification: { google: "b1uNttMPg-mggBe-7YRYuCrdH_qyy0fWGTdCQX3fY30" },
  metadataBase: new URL("https://patronage.nz"),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Patronage",
    type: "website",
    locale: "en_NZ",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://patronage.nz/#organization",
      name: "Patronage",
      url: "https://patronage.nz",
      logo: {
        "@type": "ImageObject",
        url: "https://patronage.nz/Favicon_Bleed_512.png",
      },
      description:
        "Free professional infrastructure for NZ and Australian artists — portfolio, CV, and opportunity directory.",
    },
    {
      "@type": "WebSite",
      "@id": "https://patronage.nz/#website",
      name: "Patronage",
      url: "https://patronage.nz",
      publisher: { "@id": "https://patronage.nz/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate:
            "https://patronage.nz/opportunities?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }}
        />
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
