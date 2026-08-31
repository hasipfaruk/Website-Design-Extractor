import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import './globals.css';

export const metadata: Metadata = {
  title: 'WebSift — design systems for AI coding agents',
  description:
    'Sift a website’s colours, type, spacing and components into a design.md your coding agent can follow.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable}`}
    >
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
