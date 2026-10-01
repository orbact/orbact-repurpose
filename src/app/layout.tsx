import type { Metadata } from 'next'
import './globals.css'

const siteUrl =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Orbact Repurpose — Social content drafts from one source',
  description:
    'Turn an article, YouTube video, or pasted text into LinkedIn, Facebook Page, X, Instagram, and carousel drafts with Orbact Repurpose.',
  openGraph: {
    title: 'Orbact Repurpose',
    description: 'Create platform-specific social content drafts from one source.',
    type: 'website',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
