import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Red Hat Interview Platform',
  description: 'Async code interview platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
