/** @type {import('next').NextConfig} */

// Content-Security-Policy: only our own code plus the few services the app
// really uses (Desmos, YouTube player, Supabase storage, Vercel analytics).
// Blocks injected third-party scripts, clickjacking (frame-ancestors) and
// form posts to other sites.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.desmos.com https://*.desmos.com https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.desmos.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://*.desmos.com",
  "connect-src 'self' https://*.supabase.co https://*.desmos.com https://www.desmos.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "object-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API answers are personal / live — never cache them in shared caches.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
