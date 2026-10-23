import type { MetadataRoute } from 'next'

/** Search engines may read the public pages; the student area, exams, admin and API stay out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/exam', '/admin', '/api/', '/pdf-job'] }],
    sitemap: 'https://satbyusmon.com/sitemap.xml',
    host: 'https://satbyusmon.com',
  }
}
