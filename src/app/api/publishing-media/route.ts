import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { managedPublishingPlatforms } from '@/lib/publishing-config'

export const runtime = 'nodejs'

const MAX_BYTES = 4_000_000

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!managedPublishingPlatforms().has('instagram') ||
      !process.env.MAKE_PUBLISH_WEBHOOK_URL || !process.env.MAKE_WEBHOOK_API_KEY) {
    return NextResponse.json({ error: 'Managed publishing is unavailable.' }, { status: 503 })
  }
  const sizeHeader = req.headers.get('content-length')
  const declaredSize = sizeHeader === null ? null : Number(sizeHeader)
  if (req.headers.get('content-type') !== 'image/jpeg' ||
      (declaredSize !== null && (!Number.isFinite(declaredSize) || declaredSize < 4 || declaredSize > MAX_BYTES))) {
    return NextResponse.json({ error: 'Choose a JPEG under 4 MB.' }, { status: 400 })
  }
  const reader = req.body?.getReader()
  if (!reader) return NextResponse.json({ error: 'No image received.' }, { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      return NextResponse.json({ error: 'Image exceeds 4 MB.' }, { status: 413 })
    }
    chunks.push(value)
  }
  const image = Buffer.concat(chunks)
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8 ||
      image[image.length - 2] !== 0xff || image[image.length - 1] !== 0xd9) {
    return NextResponse.json({ error: 'The file is not a valid JPEG.' }, { status: 400 })
  }
  const path = `${user.id}/${randomUUID()}.jpg`
  const admin = createAdminClient()
  const { error } = await admin.storage.from('publishing').upload(path, image, {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  })
  if (error) return NextResponse.json({ error: 'Image upload failed. Check the publishing bucket setup.' }, { status: 503 })
  const { data } = admin.storage.from('publishing').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
