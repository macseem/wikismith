import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'WikiSmith — AI Wiki Generator for GitHub Repos',
  description:
    'Paste a GitHub URL, get beautiful, feature-organized developer documentation with semantic search and AI Q&A.',
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en" className="dark">
    <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
      <AuthKitProvider>{children}</AuthKitProvider>
    </body>
  </html>
);

export default RootLayout;
