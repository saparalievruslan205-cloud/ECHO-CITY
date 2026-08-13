import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const baseMetadata: Metadata = {
  title: "ECHO CITY — цифровой двойник Бишкека",
  description: "Интерактивная карта, городская аналитика и симулятор решений для Бишкека.",
  applicationName: "ECHO CITY",
  keywords: ["Бишкек", "цифровой двойник", "городская аналитика", "транспорт", "экология"],
  openGraph: {
    title: "ECHO CITY — цифровой двойник Бишкека",
    description: "Увидьте город в реальном времени и смоделируйте последствия решений.",
    type: "website",
    locale: "ru_KG",
  },
  twitter: {
    card: "summary_large_image",
    title: "ECHO CITY — цифровой двойник Бишкека",
    description: "Интерактивная 3D-карта и симулятор городских решений.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? requestHeaders.get("host")?.split(",")[0]?.trim()
    ?? "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const defaultProtocol = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? "http" : "https";
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : defaultProtocol;
  let origin = "http://localhost:3000";
  try {
    origin = new URL(`${protocol}://${host}`).origin;
  } catch {
    // Keep a valid local metadata origin when forwarded headers are malformed.
  }
  const imageUrl = new URL("/og.png", origin).toString();
  return {
    ...baseMetadata,
    metadataBase: new URL(origin),
    openGraph: {
      ...baseMetadata.openGraph,
      images: [{ url: imageUrl, width: 1728, height: 909, alt: "ECHO CITY — цифровой двойник Бишкека" }],
    },
    twitter: {
      ...baseMetadata.twitter,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
