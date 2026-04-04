import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Community AI",
  description:
    "Teacher-first community workspace for sharing methods, discussions, and public teaching circles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-theme="light"
      className={`${bricolage.variable} ${publicSans.variable} h-full bg-[var(--paper)]`}
    >
      <body className="min-h-full bg-[var(--paper)] text-[var(--ink)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
