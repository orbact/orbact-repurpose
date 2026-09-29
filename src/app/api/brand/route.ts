import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseGenerationBrief } from '@/lib/ai/content-schema'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let value: unknown
  try {
    value = await readJsonBody(req, 2_000)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid brief' },
      { status: error instanceof RequestBodyError ? error.status : 400 }
    )
  }
  const brief = parseGenerationBrief(value)
  if (!brief) return NextResponse.json({ error: 'Invalid brand settings' }, { status: 400 })
  const { error } = await createAdminClient()
    .from('profiles')
    .update({ brand_brief: brief })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Could not save brand settings' }, { status: 503 })
  return NextResponse.json({ saved: true })
}
