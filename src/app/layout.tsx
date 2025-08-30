import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { Nunito } from 'next/font/google';
import { AuthProvider } from '@/firebase/auth';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from 'next-themes';

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: "Asrama Hurun Inn",
  description: "Website Resmi Asrama Hurun Inn Darul Ulum",
  icons: {
    icon: [
      { url: '/hurun_inn_favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/hurun_inn_favicon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/hurun_inn_favicon.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
      <html lang="id" className={nunito.variable}>
      <head>
        <link rel="icon" href="/hurun_inn_favicon.png" type="image/png" />
      </head>
      <body className="antialiased font-nunito dark:bg-gray-900 transition-colors">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
            <Navbar />
            {/* Added top padding to ensure the Navbar does not cover page content */}
            <main className="flex-grow pt-24 bg-white dark:bg-gray-900 transition-colors">
              {children}
            </main>
          </div>
        </AuthProvider>
      </ThemeProvider>
      </body>
      </html>
  );
}