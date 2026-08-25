import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FR333MAN — Question deeply. Build freely.',
  description: 'A social network for independent research, practical autonomy and open conversation.',
  openGraph: { title: 'FR333MAN — Question deeply. Build freely.', description: 'Independent minds. Practical freedom. Join the movement.', type: 'website', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'FR333MAN — Question deeply. Build freely.' }] },
  twitter: { card: 'summary_large_image', title: 'FR333MAN — Question deeply. Build freely.', description: 'Independent minds. Practical freedom. Join the movement.', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
