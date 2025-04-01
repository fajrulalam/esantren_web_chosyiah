import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { Nunito } from 'next/font/google';
import { AuthProvider } from '@/firebase/auth';
import Navbar from '@/components/Navbar';

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: "Asrama Chosyi'ah",
  description: "Website Resmi Asrama Chosyi'ah Darul Ulum",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
      <html lang="id" className={nunito.variable}>
      <body className="antialiased font-nunito dark:bg-gray-900 transition-colors">
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
          <Navbar />
          {/* Added top padding to ensure the Navbar does not cover page content */}
          <main className="flex-grow pt-24 bg-white dark:bg-gray-900 transition-colors">
            {children}
          </main>
        </div>
      </AuthProvider>
      </body>
      </html>
  );
}