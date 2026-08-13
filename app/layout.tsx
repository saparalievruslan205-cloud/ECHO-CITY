import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://echo-city-bishkek.russ2222.chatgpt.site"),
  title: "ECHO CITY — цифровой двойник Бишкека",
  description: "Интерактивная карта, городская аналитика и симулятор решений для Бишкека.",
  applicationName: "ECHO CITY",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  keywords: ["Бишкек", "цифровой двойник", "городская аналитика", "транспорт", "экология"],
  openGraph: {
    title: "ECHO CITY — цифровой двойник Бишкека",
    description: "Увидьте город в реальном времени и смоделируйте последствия решений.",
    type: "website",
    locale: "ru_KG",
    images: [{ url: "/og.png", width: 1728, height: 909, alt: "ECHO CITY — цифровой двойник Бишкека" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ECHO CITY — цифровой двойник Бишкека",
    description: "Интерактивная 3D-карта и симулятор городских решений.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
