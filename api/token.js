export default async function handler(req, res) {
  const { org } = req.query

  if (!org) {
    return res.status(400).json({ error: "Missing org parameter" })
  }

  return res.status(200).json({ ok: true, org })
}
