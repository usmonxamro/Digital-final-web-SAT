import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: 'https://satbyusmon.com/', lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://satbyusmon.com/login', lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://satbyusmon.com/login?mode=signup', lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]
}
