import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ org: string }> }
) {
  const { org } = await context.params

  return NextResponse.json({ ok: true, org })
}
