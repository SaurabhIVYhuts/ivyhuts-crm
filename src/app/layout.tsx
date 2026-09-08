import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_NO_FLASH_SCRIPT } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IVYHUTS CRM",
  description: "Internal marketing/sales CRM for IVYHUTS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored light/dark choice before first paint so the
            shell never flashes the wrong theme. Kept in sync with
            ThemeProvider via the shared STORAGE_KEY. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
