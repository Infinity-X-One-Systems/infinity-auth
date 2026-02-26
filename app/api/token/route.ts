import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const org = searchParams.get("org")

  if (!org) {
    return NextResponse.json({ error: "Missing org parameter" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, org })
}
