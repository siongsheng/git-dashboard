import type { Metadata } from "next";
import Link from "next/link";
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
  title: "Git Dashboard",
  description: "Manage repos and drive Claude agents on features and bug fixes",
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
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-strong font-mono text-[13px] text-white">
                ⌥
              </span>
              Git Dashboard
            </Link>
            <nav className="flex items-center gap-1 text-sm text-muted">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Repos
              </Link>
              <Link
                href="/stats"
                className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Stats
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
