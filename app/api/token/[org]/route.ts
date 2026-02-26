import { NextRequest, NextResponse } from 'next/server'

function base64url(input: Buffer) {
  return input.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function generateJWT(appId: string, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 600,
    iss: appId,
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${encodedHeader}.${encodedPayload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Buffer.from(
      privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\n/g, ''),
      'base64'
    ),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data)
  )

  const encodedSignature = Buffer.from(signature).toString('base64url')
  return `${data}.${encodedSignature}`
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ org: string }> }
) {
  try {
    const { org } = await context.params

    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_PRIVATE_KEY

    if (!appId || !privateKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
    }

    const jwtToken = await generateJWT(appId, privateKey)

    const installationsRes = await fetch(
      'https://api.github.com/app/installations',
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    const installations = await installationsRes.json()

    const installation = installations.find(
      (i: any) => i.account.login === org
    )

    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 })
    }

    const tokenRes = await fetch(
      `https://api.github.com/app/installations/${installation.id}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    const tokenData = await tokenRes.json()

    return NextResponse.json({
      org,
      expires_at: tokenData.expires_at,
      token: tokenData.token,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
