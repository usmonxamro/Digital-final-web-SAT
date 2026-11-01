import type { MetadataRoute } from 'next'

/** Web app manifest — name and icons shown when the site is added to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SAT by Usmon',
    short_name: 'SAT by Usmon',
    description: "Digital SAT'ga o'zbek tilida tayyorgarlik: mock testlar, savollar banki, natijalar tahlili.",
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#05060a',
    theme_color: '#ff7a1a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
