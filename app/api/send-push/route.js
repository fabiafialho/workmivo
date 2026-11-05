// app/api/send-push/route.js
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:contato@workmivo.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(req) {
  try {
    const { subscription, title, body, url } = await req.json()
    if (!subscription) return Response.json({ error: 'no subscription' }, { status: 400 })

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url: url || '/', tag: 'workmivo' })
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Push error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
