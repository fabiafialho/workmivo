import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  const { email } = await req.json()

  if (!email) {
    return Response.json({ error: 'email obrigatório' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'acesso@workmivoapp.lat',
    to: email,
    subject: '¡Tu acceso a Workmivo está listo!',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Acceso a Workmivo</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0d3330;padding:36px 40px;text-align:center;">
              <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.04em;">Workmivo</div>
              <div style="font-size:13px;color:#baff37;margin-top:6px;font-weight:600;">Tu negocio de servicios, bajo control</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a2e1a;font-weight:700;">¡Bienvenido a Workmivo!</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4a5568;line-height:1.7;">
                Tu compra fue confirmada y tu cuenta ya está creada. Para acceder, sigue estos pasos:
              </p>

              <!-- Steps box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;border-radius:8px;border:1px solid #d6e5db;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:14px;color:#1a2e1a;line-height:1.7;">
                      <strong>1.</strong> Haz clic en el botón de abajo para ir a Workmivo
                    </p>
                    <p style="margin:0 0 12px;font-size:14px;color:#1a2e1a;line-height:1.7;">
                      <strong>2.</strong> Haz clic en <strong>"¿Olvidaste tu contraseña?"</strong>
                    </p>
                    <p style="margin:0;font-size:14px;color:#1a2e1a;line-height:1.7;">
                      <strong>3.</strong> Ingresa <strong>${email}</strong> y recibirás un link para crear tu propia contraseña
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="https://workmivoapp.lat" style="display:inline-block;background:#0d3330;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                      Ir a Workmivo →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#4a5568;line-height:1.7;">
                El <strong>manual de uso completo</strong> está disponible dentro de la plataforma Hotmart, en el área de contenido de tu compra.
              </p>

              <p style="margin:0;font-size:13px;color:#5a7a6a;">
                ¿Tienes algún problema? Escríbenos a
                <a href="mailto:admsolarads@gmail.com" style="color:#0d3330;">admsolarads@gmail.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f7f4;padding:20px 40px;text-align:center;border-top:1px solid #d6e5db;">
              <p style="margin:0;font-size:12px;color:#5a7a6a;">
                © 2024 Workmivo · <a href="https://workmivoapp.lat" style="color:#0d3330;text-decoration:none;">workmivoapp.lat</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  })

  if (error) {
    console.error('Resend error:', error)
    return Response.json({ error }, { status: 500 })
  }

  return Response.json({ ok: true })
}
