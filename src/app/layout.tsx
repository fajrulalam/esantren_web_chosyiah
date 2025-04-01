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
  title: 'Asrama Chosyi\'ah',
  description: 'Website Resmi Asrama Chosyi\'ah Darul Ulum',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={nunito.variable}>
      <body className="antialiased font-nunito">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            {/* Footer removed from layout as we have custom footer in landing page */}
            {/* Each authenticated page will have its own footer if needed */}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}