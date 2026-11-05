import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { to, customerName, companyName, estimateTitle, estimateTotal, currency, portalLink, notes } = await req.json()

    if (!to) return NextResponse.json({ error: 'Email do cliente não informado' }, { status: 400 })

    const fmt = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: currency || 'USD' })

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#0d2e1a;padding:28px 32px">
          <div style="font-size:20px;font-weight:700;color:#c8f135">${companyName}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:15px;color:#333">Olá, <strong>${customerName}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#666">Você recebeu um novo orçamento de <strong>${companyName}</strong>.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px;margin-bottom:24px">
            <tr>
              <td style="font-size:13px;color:#999;padding-bottom:4px">Orçamento</td>
            </tr>
            <tr>
              <td style="font-size:16px;font-weight:600;color:#111">${estimateTitle}</td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:700;color:#0d2e1a;padding-top:8px">${fmt(estimateTotal)}</td>
            </tr>
          </table>

          ${notes ? `<p style="margin:0 0 24px;font-size:13px;color:#555;background:#f4f4f4;padding:12px;border-radius:4px">${notes}</p>` : ''}

          ${portalLink ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td align="center">
              <a href="${portalLink}" style="display:inline-block;background:#c8f135;color:#0d2e1a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:6px;text-decoration:none">
                Ver e aprovar orçamento →
              </a>
            </td></tr>
          </table>
          ` : ''}

          <p style="margin:0;font-size:12px;color:#aaa;text-align:center">
            Enviado via Workmivo · ${companyName}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Workmivo <onboarding@resend.dev>',
        to: [to],
        subject: `Orçamento: ${estimateTitle} — ${companyName}`,
        html
      })
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.message || 'Erro ao enviar' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
