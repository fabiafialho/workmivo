import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { to, customerName, companyName, estimateTitle, estimateTotal, currency, portalLink, notes } = await req.json()

    if (!to) return NextResponse.json({ error: 'Email del cliente no informado' }, { status: 400 })

    const fmt = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: currency || 'USD' })

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f5;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr><td style="background:#0d3330;padding:28px 32px">
          <div style="font-size:20px;font-weight:800;color:#baff37;letter-spacing:-0.03em">${companyName}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 8px;font-size:15px;color:#1a2e1a">Hola, <strong>${customerName}</strong>.</p>
          <p style="margin:0 0 24px;font-size:14px;color:#4a5568;line-height:1.7">
            Recibiste una cotización de <strong>${companyName}</strong>. Revísala y apruébala online con un solo clic.
          </p>

          <!-- Estimate box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;border-radius:8px;border:1px solid #d6e5db;margin-bottom:24px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 4px;font-size:12px;color:#5a7a6a;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Cotización</p>
              <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2e1a">${estimateTitle}</p>
              <p style="margin:0;font-size:24px;font-weight:800;color:#0d3330;letter-spacing:-0.03em">${fmt(estimateTotal)}</p>
            </td></tr>
          </table>

          ${notes ? `<p style="margin:0 0 24px;font-size:13px;color:#4a5568;background:#f9fafb;padding:14px;border-radius:6px;border-left:3px solid #d6e5db;line-height:1.6">${notes}</p>` : ''}

          ${portalLink ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td align="center">
              <a href="${portalLink}" style="display:inline-block;background:#0d3330;color:#ffffff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none">
                Ver y aprobar cotización →
              </a>
            </td></tr>
          </table>
          ` : ''}

          <p style="margin:0;font-size:13px;color:#5a7a6a;text-align:center">
            Enviado por <strong>${companyName}</strong> vía Workmivo
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f0f7f4;padding:20px 40px;text-align:center;border-top:1px solid #d6e5db">
          <p style="margin:0;font-size:12px;color:#5a7a6a">
            Workmivo · <a href="https://workmivoapp.lat" style="color:#0d3330;text-decoration:none">workmivoapp.lat</a>
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
        from: `${companyName} <acesso@workmivoapp.lat>`,
        to: [to],
        subject: `Cotización: ${estimateTitle} — ${companyName}`,
        html
      })
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.message || 'Error al enviar' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
