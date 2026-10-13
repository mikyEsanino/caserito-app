import type { MetadataRoute } from 'next';

// PWA: permite instalar Caserito en el celular como una app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Caserito · El asistente de la bodega',
    short_name: 'Caserito',
    description: 'Inventario por lotes, vencimientos y ventas para tu bodega.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#faf6ef',
    theme_color: '#b3431b',
    lang: 'es-PE',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
