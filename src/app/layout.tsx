import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBarServer } from "@/components/layout/MobileTabBarServer";
import { PostHogProvider } from "@/components/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Patronage | Professional Infrastructure for Artists";
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
  manifest: "/manifest.json",
  // Apple standalone (Add to Home Screen). Renders:
  //   <meta name="apple-mobile-web-app-capable" content="yes">
  //   <meta name="apple-mobile-web-app-status-bar-style" content="default">
  //   <meta name="apple-mobile-web-app-title" content="Patronage">
  appleWebApp: {
    capable: true,
    title: "Patronage",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Required for env(safe-area-inset-*) to resolve on iPhone — without it the
  // mobile tab bar's safe-area padding computes to 0 and icons sit in the
  // curved corner / home-indicator zone.
  viewportFit: "cover",
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
        "Free professional infrastructure for NZ and Australian artists: portfolio, CV, and opportunity directory.",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <PostHogProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileTabBarServer />
          {modal}
          <Toaster position="bottom-center" />
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
