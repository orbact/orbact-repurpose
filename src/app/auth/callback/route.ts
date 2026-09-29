import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login?auth_error=1`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?auth_error=1`)

  const destination = searchParams.get('next') === '/reset-password'
    ? '/reset-password'
    : '/dashboard'
  return NextResponse.redirect(`${origin}${destination}`)
}
