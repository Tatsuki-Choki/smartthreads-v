export function getBaseUrl(): string {
  // Prefer explicit APP_URL for server-side routes
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    return appUrl.replace(/\/$/, '')
  }

  // Vercel provides VERCEL_URL without protocol
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Fallback to localhost for development
  return 'http://localhost:3000'
}

