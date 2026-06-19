const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? ''
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM ?? ''

export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) return false

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: TWILIO_FROM,
      To: `whatsapp:${to}`,
      Body: body,
    }),
  })

  return res.status === 201
}

export async function sendWhatsAppBulk(
  numbers: string[],
  body: string,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(numbers.map((n) => sendWhatsApp(n, body)))
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length
  return { sent, failed: numbers.length - sent }
}
