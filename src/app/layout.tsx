import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import ErrorBoundary from "@/components/ErrorBoundary"; // Removed { }
import { ToastProvider } from "@/contexts/ToastContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SuppressMixpanelErrors } from "@/components/SuppressMixpanelErrors";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: "Stacq - Curated Resource Platform",
    template: "%s | Stacq",
  },
  description: "Discover and share curated resources with the community.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  icons: {
    icon: '/favicon.ico', // Standard favicon
    shortcut: '/favicon-16x16.png', // Optional: additional shortcut icon
    apple: '/apple-touch-icon.png', // Optional: for iOS devices
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SuppressMixpanelErrors />
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}