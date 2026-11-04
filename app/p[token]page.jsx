'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function PortalPage({ params }) {
  const { token } = params
  const [estimate, setEstimate] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [done, setDone] = useState(null) // 'approved' | 'rejected'
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: est } = await supabase
        .from('estimates')
        .select('*')
        .eq('approval_token', token)
        .single()

      if (!est) { setError('Orçamento não encontrado.'); setLoading(false); return }
      setEstimate(est)

      if (est.status === 'approved') setDone('approved')
      if (est.status === 'rejected') setDone('rejected')

      const [{ data: its }, { data: co }, { data: cu }] = await Promise.all([
        supabase.from('estimate_items').select('*').eq('estimate_id', est.id).order('sort_order'),
        supabase.from('companies').select('*').eq('id', est.company_id).single(),
        est.customer_id ? supabase.from('customers').select('*').eq('id', est.customer_id).single() : { data: null },
      ])

      setItems(its || [])
      setCompany(co)
      setCustomer(cu)
      setLoading(false)
    }
    load()
  }, [token])

  const act = async (action) => {
    setActing(true)
    const payload = action === 'approved'
      ? { status: 'approved', approved_at: new Date().toISOString() }
      : { status: 'rejected', rejected_at: new Date().toISOString() }
    await supabase.from('estimates').update(payload).eq('approval_token', token)
    setDone(action)
    setActing(false)
  }

  const fmt = (v) => Number(v || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: company?.currency || 'USD',
  })

  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
    </div>
  )

  if (error) return (
    <div style={styles.center}>
      <div style={styles.card}>
        <p style={{ color: '#888' }}>{error}</p>
      </div>
    </div>
  )

  if (done) return (
    <div style={styles.center}>
      <div style={styles.card}>
        {company?.logo_url && <img src={company.logo_url} alt={company.name} style={{ height: 40, objectFit: 'contain', marginBottom: 24 }} />}
        <div style={{ fontSize: 48, marginBottom: 12 }}>{done === 'approved' ? '✅' : '❌'}</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>
          {done === 'approved' ? 'Orçamento aprovado!' : 'Orçamento recusado.'}
        </h2>
        <p style={{ color: '#888', fontSize: 14 }}>
          {done === 'approved'
            ? 'Obrigado! Entraremos em contato em breve.'
            : 'Entendemos. Entre em contato se quiser ajustar.'}
        </p>
      </div>
    </div>
  )

  const canAct = estimate.status === 'sent' || estimate.status === 'draft'

  return (
    <div style={styles.page}>
      <div style={styles.doc}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            {company?.logo_url && <img src={company.logo_url} alt={company.name} style={{ height: 44, objectFit: 'contain', marginBottom: 8 }} />}
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>ORÇAMENTO</div>
            <div style={{ fontSize: 12, color: '#888' }}>#{estimate.id.slice(-6).toUpperCase()}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: '#555', lineHeight: 1.7 }}>
            <strong style={{ color: '#111' }}>{company?.name}</strong><br />
            {company?.email && <>{company.email}<br /></>}
            {company?.phone && <>{company.phone}<br /></>}
            {company?.address && <>{company.address}<br /></>}
          </div>
        </div>

        {/* Info row */}
        <div style={styles.infoRow}>
          {customer && (
            <div>
              <div style={styles.infoLabel}>Cliente</div>
              <div style={styles.infoVal}>{customer.name}</div>
              {customer.email && <div style={{ fontSize: 12, color: '#888' }}>{customer.email}</div>}
              {customer.phone && <div style={{ fontSize: 12, color: '#888' }}>{customer.phone}</div>}
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={styles.infoLabel}>Data</div>
            <div style={styles.infoVal}>{new Date(estimate.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        {/* Title / description */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{estimate.title}</div>
          {estimate.description && <div style={{ fontSize: 13, color: '#666' }}>{estimate.description}</div>}
        </div>

        {/* Items */}
        {items.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Descrição', 'Qtd', 'Unit.', 'Total'].map(h => (
                  <th key={h} style={{ ...styles.th, textAlign: h !== 'Descrição' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.description?.trim()).map(it => (
                <tr key={it.id}>
                  <td style={styles.td}>{it.description}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{it.quantity}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div style={styles.totals}>
          <div style={styles.totalRow}><span>Subtotal</span><span>{fmt(estimate.subtotal)}</span></div>
          {Number(estimate.discount) > 0 && <div style={styles.totalRow}><span>Desconto</span><span>-{fmt(estimate.discount)}</span></div>}
          {Number(estimate.tax) > 0 && <div style={styles.totalRow}><span>Impostos</span><span>{fmt(estimate.tax)}</span></div>}
          <div style={styles.grandTotal}><span>Total</span><span>{fmt(estimate.total)}</span></div>
        </div>

        {/* Notes */}
        {estimate.notes && (
          <div style={styles.notes}><strong>Observações:</strong> {estimate.notes}</div>
        )}

        {/* CTA */}
        {canAct && (
          <div style={styles.cta}>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 20, textAlign: 'center' }}>
              Revise o orçamento acima e confirme sua decisão:
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={styles.btnReject} onClick={() => act('rejected')} disabled={acting}>
                ✕ Recusar
              </button>
              <button style={styles.btnApprove} onClick={() => act('approved')} disabled={acting}>
                ✓ Aprovar orçamento
              </button>
            </div>
          </div>
        )}

        {!canAct && (
          <div style={{ textAlign: 'center', marginTop: 32, padding: 16, background: '#f5f5f5', borderRadius: 8, fontSize: 13, color: '#888' }}>
            Este orçamento já foi {estimate.status === 'approved' ? 'aprovado' : estimate.status === 'rejected' ? 'recusado' : estimate.status}.
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f0f0f0', display: 'flex', justifyContent: 'center', padding: '40px 16px', fontFamily: 'system-ui, sans-serif' },
  doc: { background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 48px', maxWidth: 680, width: '100%' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', fontFamily: 'system-ui, sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 400 },
  spinner: { width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 28 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', color: '#aaa', letterSpacing: 0.5, marginBottom: 2 },
  infoVal: { fontWeight: 600, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 16 },
  th: { padding: '8px 12px', background: '#f8f8f8', fontSize: 11, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5, fontWeight: 600 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13 },
  totals: { marginLeft: 'auto', width: 220, marginTop: 8, marginBottom: 24 },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#555' },
  grandTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, padding: '10px 0 0', borderTop: '2px solid #111', marginTop: 6 },
  notes: { padding: 16, background: '#f9f9f9', borderRadius: 8, fontSize: 13, color: '#666', marginBottom: 24 },
  cta: { borderTop: '1px solid #eee', paddingTop: 32, marginTop: 24 },
  btnApprove: { background: '#16a34a', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnReject: { background: '#fff', color: '#666', border: '1px solid #ddd', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}
