import crypto from "crypto"

async function generateJWT(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    alg: "RS256",
    typ: "JWT"
  }

  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId
  }

  function base64url(input) {
    return Buffer.from(JSON.stringify(input))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
  }

  const unsignedToken = `${base64url(header)}.${base64url(payload)}`

  const sign = crypto.createSign("RSA-SHA256")
  sign.update(unsignedToken)
  sign.end()

  const signature = sign
    .sign(privateKey)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  return `${unsignedToken}.${signature}`
}

async function getInstallationToken(org) {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY

  const jwt = await generateJWT(appId, privateKey)

  const installationsRes = await fetch(
    "https://api.github.com/app/installations",
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json"
      }
    }
  )

  const installations = await installationsRes.json()
  const installation = installations.find(i => i.account.login === org)

  if (!installation) {
    throw new Error("Installation not found")
  }

  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json"
      }
    }
  )

  const tokenData = await tokenRes.json()
  return tokenData.token
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" })
  }

  const { org, action } = req.body

  if (!org || !action) {
    return res.status(400).json({ error: "Missing org or action" })
  }

  try {
    const installationToken = await getInstallationToken(org)

    if (action === "listRepos") {
      const response = await fetch(
        `https://api.github.com/orgs/${org}/repos`,
        {
          headers: {
            Authorization: `Bearer ${installationToken}`,
            Accept: "application/vnd.github+json"
          }
        }
      )

      const data = await response.json()
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: "Unknown action" })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
