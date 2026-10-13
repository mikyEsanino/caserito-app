import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Caserito', template: '%s · Caserito' },
  description: 'El asistente inteligente de la bodega: inventario por lotes, vencimientos y ventas.',
  applicationName: 'Caserito',
  appleWebApp: { capable: true, title: 'Caserito', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#b3431b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body className="antialiased">{children}</body>
    </html>
  );
}
