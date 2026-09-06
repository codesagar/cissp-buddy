import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'CISSP Buddy — learn the connections',
  icons: { icon: '/favicon.svg' },
  description:
    'A focused visual CISSP study companion with connected lessons, ten-minute practice, and personal review.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
