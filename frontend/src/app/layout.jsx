import './globals.css';
import { Toaster } from 'react-hot-toast';
import DirHandler from '@/components/DirHandler';

export const metadata = {
  title: 'ST Bot | بوت ديسكورد متكامل',
  description: 'منصة SaaS عربية شاملة تضم نظام تذاكر، مسابقات، أذكار، وإذاعة جماعية',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body>
        <DirHandler />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#15090a',
              color: '#fff',
              border: '1px solid rgba(220, 38, 38, 0.2)',
            },
            success: {
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  );
}
