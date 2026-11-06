import { createClient } from '@supabase/supabase-js'

// Supabase admin client (service role — bypassa RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mapeia offer_code da Hotmart para o plano do Workmivo
const PLAN_MAP = {
  lf7dxz0c: 'basico',
  zny1lf7n: 'pro',
  ci1xwiua: 'business',
}

function getPlan(payload) {
  const offerCode = payload?.purchase?.offer?.code?.toLowerCase() || ''
  return PLAN_MAP[offerCode] || 'basico'
}

export async function POST(req) {
  try {
    const body = await req.json()

    // Hotmart envia evento no campo event
    const event = body?.event
    if (event !== 'PURCHASE_APPROVED' && event !== 'PURCHASE_COMPLETE') {
      return Response.json({ ok: true, msg: 'evento ignorado' })
    }

    const email = body?.data?.buyer?.email
    const name  = body?.data?.buyer?.name || ''
    const plan  = getPlan(body?.data)

    if (!email) {
      return Response.json({ error: 'email não encontrado no payload' }, { status: 400 })
    }

    // 1. Cria usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // confirma direto, sem precisar verificar email
      user_metadata: { name, plan }
    })

    if (authError && !authError.message.includes('already registered')) {
      console.error('Erro ao criar usuário:', authError)
      return Response.json({ error: authError.message }, { status: 500 })
    }

    const userId = authData?.user?.id

    // 2. Se o usuário já existia, atualiza o plano
    if (authError?.message.includes('already registered')) {
      const { data: existing } = await supabase.auth.admin.listUsers()
      const found = existing?.users?.find(u => u.email === email)
      if (found) {
        await supabase
          .from('companies')
          .update({ plan })
          .eq('user_id', found.id)
      }
    } else if (userId) {
      // 3. Cria empresa vinculada ao usuário
      await supabase.from('companies').insert({
        user_id: userId,
        name: name || 'Mi empresa',
        plan
      })
    }

    // 4. Envia email de boas-vindas com link para criar senha
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    return Response.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
