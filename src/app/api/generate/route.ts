import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRepurposedContent } from '@/lib/ai/generate-content'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.title || !body?.text) {
    return NextResponse.json({ error: 'Missing title or text' }, { status: 400 })
  }
  const { title, text, sourceType } = body as { title: string; text: string; sourceType: string }

  // Enforce usage limit BEFORE calling the AI — never spend money on a call you're going to reject
  const { data: allowed, error: consumeError } = await supabase.rpc(
    'try_consume_generation',
    { p_user_id: user.id }
  )

  if (consumeError) {
    return NextResponse.json({ error: 'Could not verify usage' }, { status: 500 })
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Generation limit reached for your plan. Upgrade to continue.' },
      { status: 403 }
    )
  }

  // Insert a pending row first — so even if generation fails, we have a record and can debug/retry
  const { data: genRow, error: insertError } = await supabase
    .from('generations')
    .insert({
      user_id: user.id,
      input_type: sourceType || 'text',
      input_raw: text.slice(0, 2000), // store a preview, not the full 40k chars, to keep rows lean
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !genRow) {
    return NextResponse.json({ error: 'Could not create generation record' }, { status: 500 })
  }

  try {
    const outputs = await generateRepurposedContent(title, text)

    await supabase
      .from('generations')
      .update({ outputs, status: 'complete' })
      .eq('id', genRow.id)

    return NextResponse.json({ id: genRow.id, outputs })
  } catch (err) {
    await supabase
      .from('generations')
      .update({ status: 'failed' })
      .eq('id', genRow.id)

    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}