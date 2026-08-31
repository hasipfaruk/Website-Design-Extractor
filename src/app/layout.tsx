import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Design Extractor — pull a site’s design system from its URL',
  description:
    'Paste a website URL and get its colours, fonts, type scale, spacing, radii, shadows, icons and components as a downloadable design.md.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
