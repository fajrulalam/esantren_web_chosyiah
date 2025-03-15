import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/firebase/auth';
import Navbar from '@/components/Navbar';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Sistem Pembayaran Asrama',
  description: 'Aplikasi untuk mengelola pembayaran santri',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="antialiased bg-gray-50 dark:bg-gray-900 transition-colors">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <footer className="py-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
              <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300 text-sm">
                © {new Date().getFullYear()} Sistem Pembayaran Asrama. Hak cipta dilindungi.
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}