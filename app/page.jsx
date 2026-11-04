'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { tr } from '../lib/translations'
import {
  LayoutDashboard, Users, FileText, Briefcase, Receipt,
  Settings, Menu, X, LogOut, Plus, Edit2, Trash2,
  DollarSign, TrendingUp, Clock, UserCheck, Trash
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMITS = {
  basico:   { customers: 30,       estimates_month: 10,  dashboard: false, approval: false },
  pro:      { customers: 300,      estimates_month: 300, dashboard: true,  approval: true  },
  business: { customers: Infinity, estimates_month: Infinity, dashboard: true, approval: true }
}

const STATUS_COLOR = {
  draft: '#6b7280', sent: '#3b82f6', viewed: '#8b5cf6',
  approved: '#10b981', changes_requested: '#f59e0b', declined: '#ef4444',
  scheduled: '#3b82f6', in_progress: '#f59e0b', completed: '#10b981', cancelled: '#6b7280',
  paid: '#10b981', void: '#ef4444', active: '#10b981'
}

const ESTIMATE_STATUSES = ['draft','sent','viewed','approved','changes_requested','declined']
const JOB_STATUSES      = ['scheduled','in_progress','completed','cancelled']
const INVOICE_STATUSES  = ['draft','sent','paid','void']
const LANGS             = ['es','en','pt']
const CURRENCIES        = ['USD','MXN','EUR','COP','ARS','CLP','BRL']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fCurrency = (n, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(Number(n) || 0)

const fDate = d => d ? new Date(d).toLocaleDateString() : '—'

const Logo = ({ size = 32 }) => (
  <img src="/logo.png" width={size} height={size} alt="Workmivo" style={{ objectFit: 'contain' }} />
)

// Avatar with initials
const Avatar = ({ name, size = 32 }) => {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const colors = ['#2d6a4f','#1e6091','#7b2d8b','#b5451b','#1a535c','#4a4e69','#2b6cb0','#276749']
  const idx = (name || '').charCodeAt(0) % colors.length
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: colors[idx], color: '#fff',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      letterSpacing: 0.5
    }}>{initials}</span>
  )
}

// Empty state
const EmptyState = ({ icon, title, sub }) => (
  <tr>
    <td colSpan={99} style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{sub}</div>}
    </td>
  </tr>
)

const InlineNewCustomer = ({ value, onChange, customers, inlineCustomer, setInlineCustomer, saveInlineCustomer, savingCustomer, lang }) => (
  <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select value={value || ''} onChange={e => {
        if (e.target.value === '__new__') { setInlineCustomer({ name: '', phone: '', email: '' }); return }
        onChange(e.target.value)
      }} style={{ flex: 1 }}>
        <option value="">—</option>
        <option value="__new__">＋ {lang === 'pt' ? 'Novo cliente' : lang === 'en' ? 'New customer' : 'Nuevo cliente'}</option>
        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
    {inlineCustomer !== null && (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--dark3)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {lang === 'pt' ? 'Novo cliente' : lang === 'en' ? 'New customer' : 'Nuevo cliente'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input placeholder={lang === 'pt' ? 'Nome *' : lang === 'en' ? 'Name *' : 'Nombre *'}
            value={inlineCustomer.name} autoFocus
            onChange={e => setInlineCustomer(c => ({ ...c, name: e.target.value }))}
            style={{ gridColumn: '1 / -1' }} />
          <input placeholder={lang === 'pt' ? 'Telefone' : 'Teléfono'}
            value={inlineCustomer.phone}
            onChange={e => setInlineCustomer(c => ({ ...c, phone: e.target.value }))} />
          <input placeholder={lang === 'pt' ? 'Email' : 'Correo'}
            value={inlineCustomer.email}
            onChange={e => setInlineCustomer(c => ({ ...c, email: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setInlineCustomer(null)}>✕</button>
          <button className="btn btn-primary btn-sm" onClick={saveInlineCustomer} disabled={savingCustomer || !inlineCustomer.name?.trim()}>
            {savingCustomer ? '...' : (lang === 'pt' ? 'Salvar' : lang === 'en' ? 'Save' : 'Guardar')}
          </button>
        </div>
      </div>
    )}
  </div>
)

const Badge = ({ status, label }) => (
  <span className="badge" style={{
    background: `${STATUS_COLOR[status] || '#6b7280'}22`,
    color: STATUS_COLOR[status] || '#6b7280',
    border: `1px solid ${STATUS_COLOR[status] || '#6b7280'}44`
  }}>{label}</span>
)

const newItem = () => ({ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 })

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState('es')
  const [stage, setStage] = useState('loading')  // loading|login|register|forgot|workspace|onboarding|app
  const [onboardStep, setOnboardStep] = useState(1)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [plan, setPlan] = useState('basico')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [customers, setCustomers] = useState([])
  const [estimates, setEstimates] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [stats, setStats] = useState({ customers: 0, paidTotal: 0, activeJobs: 0, pendingEst: 0 })

  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([newItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [inlineCustomer, setInlineCustomer] = useState(null) // null | { name, phone, email }
  const [savingCustomer, setSavingCustomer] = useState(false)

  const T = k => tr(k, lang)
  const limits = LIMITS[plan] || LIMITS.basico

  // ─── Init lang ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('wm_lang') : null
    if (saved && LANGS.includes(saved)) setLang(saved)
  }, [])

  const changeLang = l => {
    setLang(l)
    if (typeof window !== 'undefined') localStorage.setItem('wm_lang', l)
  }

  // ─── Auth init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setStage('login'); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadCompany(session.user) }
      else setStage('login')
    })
    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setCompany(null); setStage('login') }
    })
    return () => sub.unsubscribe()
  }, [])

  // ─── Load company ───────────────────────────────────────────────────────────
  const loadCompany = async (u) => {
    try {
      const { data: member } = await supabase
        .from('company_members').select('company_id').eq('user_id', u.id).single()
      if (!member) { setStage('workspace'); return }

      const [{ data: co }, { data: sub }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', member.company_id).single(),
        supabase.from('subscriptions').select('*').eq('company_id', member.company_id).single()
      ])
      setCompany(co)
      setPlan(sub?.plan || 'basico')
      if (!co.onboarded) { setForm({ ...co }); setStage('onboarding') }
      else { setStage('app'); await loadData(co.id) }
    } catch { setStage('login') }
  }

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (cid) => {
    const id = cid || company?.id
    if (!id || !supabase) return
    const [c, e, j, i] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', id).order('created_at', { ascending: false }),
      supabase.from('estimates').select('*, customers(name)').eq('company_id', id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('*, customers(name)').eq('company_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, customers(name)').eq('company_id', id).order('created_at', { ascending: false })
    ])
    const cd = c.data || []; const ed = e.data || []; const jd = j.data || []; const id2 = i.data || []
    setCustomers(cd); setEstimates(ed); setJobs(jd); setInvoices(id2)
    setStats({
      customers: cd.length,
      paidTotal: id2.filter(x => x.status === 'paid').reduce((s, x) => s + Number(x.total), 0),
      activeJobs: jd.filter(x => ['scheduled','in_progress'].includes(x.status)).length,
      pendingEst: ed.filter(x => ['sent','viewed'].includes(x.status)).length
    })
  }, [company])

  // ─── Auth handlers ──────────────────────────────────────────────────────────
  const [authForm, setAuthForm] = useState({ email: '', password: '' })

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    const { error: err } = await supabase.auth.signInWithPassword(authForm)
    if (err) { setError(T('errorLogin')); setSaving(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session.user); loadCompany(session.user); setSaving(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    const { error: err } = await supabase.auth.signUp(authForm)
    if (err) { setError(err.message); setSaving(false); return }
    setMsg('Revisa tu correo para confirmar tu cuenta.'); setSaving(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(authForm.email)
    if (err) { setError(err.message); setSaving(false); return }
    setMsg(T('checkEmail')); setSaving(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  // ─── Workspace ──────────────────────────────────────────────────────────────
  const handleCreateWorkspace = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    if (!form.name?.trim()) { setError(T('errorRequired')); setSaving(false); return }
    const { data: co, error: err } = await supabase.from('companies').insert({ name: form.name, language: lang }).select().single()
    if (err) { setError(T('errorGeneric')); setSaving(false); return }
    await supabase.from('company_members').insert({ company_id: co.id, user_id: user.id, role: 'owner' })
    await supabase.from('subscriptions').insert({ company_id: co.id, plan: 'basico' })
    setCompany(co); setPlan('basico'); setForm({ name: co.name }); setStage('onboarding'); setSaving(false)
  }

  // ─── CRUD helpers ───────────────────────────────────────────────────────────
  const openModal = (type, record = null) => {
    setModal(type); setEditing(record); setError('')
    if (type === 'estimates') {
      setForm(record ? { ...record } : { status: 'draft', subtotal: 0, discount: 0, tax: 0, total: 0 })
      if (record) {
        supabase.from('estimate_items').select('*').eq('estimate_id', record.id).order('sort_order')
          .then(({ data }) => setItems(data?.length ? data : [newItem()]))
      } else setItems([newItem()])
    } else {
      setForm(record ? { ...record } : (type === 'jobs' ? { status: 'scheduled' } : type === 'invoices' ? { status: 'draft', subtotal: 0, discount: 0, tax: 0, total: 0 } : {}))
    }
    setMsg('')
  }

  const closeModal = () => { setModal(null); setEditing(null); setForm({}); setItems([newItem()]); setError(''); setInlineCustomer(null) }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ─── Estimate items calc ─────────────────────────────────────────────────────
  const calcTotals = (its, disc, tax) => {
    const sub = its.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
    const d = Number(disc) || 0
    const t = Number(tax) || 0
    const total = sub - d + t
    return { subtotal: sub, total: Math.max(0, total) }
  }

  const updateItem = (idx, field, val) => {
    const updated = items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    setItems(updated)
    const { subtotal, total } = calcTotals(updated, form.discount, form.tax)
    setForm(f => ({ ...f, subtotal, total }))
  }

  const addItem = () => setItems(i => [...i, newItem()])
  const removeItem = idx => {
    const updated = items.filter((_, i) => i !== idx)
    setItems(updated.length ? updated : [newItem()])
    const { subtotal, total } = calcTotals(updated, form.discount, form.tax)
    setForm(f => ({ ...f, subtotal, total }))
  }

  // ─── Save estimate ───────────────────────────────────────────────────────────
  const saveEstimate = async () => {
    if (!form.title?.trim()) { setError(T('errorRequired')); return }

    // plan limit check (new only)
    if (!editing) {
      const thisMonth = estimates.filter(e => new Date(e.created_at).getMonth() === new Date().getMonth()).length
      if (thisMonth >= limits.estimates_month) { setError(T('limitReached')); return }
    }

    setSaving(true)
    const payload = {
      company_id: company.id, customer_id: form.customer_id || null,
      title: form.title, description: form.description || null,
      status: form.status || 'draft',
      subtotal: form.subtotal || 0, discount: form.discount || 0,
      tax: form.tax || 0, total: form.total || 0, notes: form.notes || null
    }

    let estId = editing?.id
    if (editing) {
      await supabase.from('estimates').update(payload).eq('id', editing.id)
    } else {
      const { data } = await supabase.from('estimates').insert(payload).select().single()
      estId = data?.id
    }

    // Save items
    if (estId) {
      await supabase.from('estimate_items').delete().eq('estimate_id', estId)
      const validItems = items.filter(i => i.description?.trim())
      if (validItems.length) {
        await supabase.from('estimate_items').insert(
          validItems.map((it, idx) => ({
            estimate_id: estId,
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            sort_order: idx
          }))
        )
      }
    }

    await loadData(); setSaving(false); closeModal()
  }

  // ─── Save inline customer (from inside a modal) ──────────────────────────────
  const saveInlineCustomer = async () => {
    if (!inlineCustomer?.name?.trim()) return
    setSavingCustomer(true)
    const payload = {
      company_id: company.id, name: inlineCustomer.name,
      phone: inlineCustomer.phone || null, email: inlineCustomer.email || null,
      language: lang
    }
    const { data } = await supabase.from('customers').insert(payload).select().single()
    if (data) {
      await loadData()
      setF('customer_id', data.id)
    }
    setInlineCustomer(null)
    setSavingCustomer(false)
  }

  // ─── Save customer ───────────────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!form.name?.trim()) { setError(T('errorRequired')); return }
    if (!editing && customers.length >= limits.customers) { setError(T('limitReached')); return }
    setSaving(true)
    const payload = {
      company_id: company.id, name: form.name, email: form.email || null,
      phone: form.phone || null, address: form.address || null,
      language: form.language || 'es', notes: form.notes || null
    }
    if (editing) await supabase.from('customers').update(payload).eq('id', editing.id)
    else await supabase.from('customers').insert(payload)
    await loadData(); setSaving(false); closeModal()
  }

  // ─── Save job ────────────────────────────────────────────────────────────────
  const saveJob = async () => {
    if (!form.title?.trim()) { setError(T('errorRequired')); return }
    setSaving(true)
    const payload = {
      company_id: company.id, customer_id: form.customer_id || null,
      estimate_id: form.estimate_id || null, title: form.title,
      description: form.description || null, status: form.status || 'scheduled',
      scheduled_date: form.scheduled_date || null, notes: form.notes || null
    }
    if (editing) await supabase.from('jobs').update(payload).eq('id', editing.id)
    else await supabase.from('jobs').insert(payload)
    await loadData(); setSaving(false); closeModal()
  }

  // ─── Save invoice ────────────────────────────────────────────────────────────
  const saveInvoice = async () => {
    if (!form.title?.trim()) { setError(T('errorRequired')); return }
    setSaving(true)
    const payload = {
      company_id: company.id, customer_id: form.customer_id || null,
      job_id: form.job_id || null, estimate_id: form.estimate_id || null,
      title: form.title, status: form.status || 'draft',
      subtotal: form.subtotal || 0, discount: form.discount || 0,
      tax: form.tax || 0, total: form.total || 0,
      due_date: form.due_date || null, notes: form.notes || null
    }
    if (editing) await supabase.from('invoices').update(payload).eq('id', editing.id)
    else await supabase.from('invoices').insert(payload)
    await loadData(); setSaving(false); closeModal()
  }

  // ─── Save settings ───────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('companies').update({
      name: form.name, email: form.email, phone: form.phone,
      address: form.address, currency: form.currency, language: form.language
    }).eq('id', company.id)
    setCompany(c => ({ ...c, ...form }))
    setSaving(false); setMsg(T('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return
    await supabase.from(confirmDelete.table).delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); await loadData()
  }

  // ─── Quick status change ─────────────────────────────────────────────────────
  const quickStatus = async (table, id, status) => {
    await supabase.from(table).update({ status }).eq('id', id)
    await loadData()
  }

  // ─── Onboarding ─────────────────────────────────────────────────────────────
  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleOnboardSave = async () => {
    setSaving(true); setError('')
    let logo_url = company?.logo_url || null

    if (logoFile) {
      setUploadingLogo(true)
      const ext = logoFile.name.split('.').pop()
      const path = `${company.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true })
      if (upErr) { setError('Erro ao subir logo.'); setSaving(false); setUploadingLogo(false); return }
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      logo_url = publicUrl
      setUploadingLogo(false)
    }

    const payload = {
      name: form.name || company.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      cnpj: form.cnpj || null,
      currency: form.currency || 'USD',
      language: form.language || lang,
      payment_terms: form.payment_terms || null,
      estimate_validity_days: Number(form.estimate_validity_days) || 15,
      logo_url,
      onboarded: true
    }

    await supabase.from('companies').update(payload).eq('id', company.id)
    setCompany(c => ({ ...c, ...payload }))
    setSaving(false)
    setStage('app')
    await loadData(company.id)
  }

  // ─── Renders ─────────────────────────────────────────────────────────────────

  if (stage === 'loading') return (
    <div className="auth-wrap"><p style={{ color: 'var(--text2)' }}>{T('loading')}</p></div>
  )

  if (stage === 'login') return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo"><Logo /><span className="auth-logo-name">Workmivo</span></div>
        <div className="auth-sub">{T('tagline')}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <div className="lang-switch">{LANGS.map(l => (
            <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => changeLang(l)}>{l.toUpperCase()}</button>
          ))}</div>
        </div>
        <h1 className="auth-title">{T('login')}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={handleLogin}>
          <div className="field"><label>{T('email')}</label>
            <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} required /></div>
          <div className="field"><label>{T('password')}</label>
            <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} required /></div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 12 }} disabled={saving}>{saving ? T('loading') : T('login')}</button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
          <button className="btn-ghost btn" style={{ fontSize: 13, padding: '4px 0' }} onClick={() => { setStage('register'); setError(''); setMsg('') }}>{T('noAccount')} {T('register')}</button>
          <button className="btn-ghost btn" style={{ fontSize: 13, padding: '4px 0' }} onClick={() => { setStage('forgot'); setError(''); setMsg('') }}>{T('forgotPassword')}</button>
        </div>
      </div>
    </div>
  )

  if (stage === 'register') return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo"><Logo /><span className="auth-logo-name">Workmivo</span></div>
        <div className="auth-sub">{T('tagline')}</div>
        <h1 className="auth-title">{T('register')}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={handleRegister}>
          <div className="field"><label>{T('email')}</label>
            <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} required /></div>
          <div className="field"><label>{T('password')}</label>
            <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} required /></div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 12 }} disabled={saving}>{saving ? T('loading') : T('register')}</button>
        </form>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setStage('login'); setError(''); setMsg('') }}>{T('hasAccount')} {T('login')}</button>
      </div>
    </div>
  )

  if (stage === 'forgot') return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo"><Logo /><span className="auth-logo-name">Workmivo</span></div>
        <h1 className="auth-title">{T('resetPassword')}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={handleForgot}>
          <div className="field"><label>{T('email')}</label>
            <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} required /></div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 12 }} disabled={saving}>{saving ? T('loading') : T('sendResetLink')}</button>
        </form>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setStage('login'); setError(''); setMsg('') }}>← {T('login')}</button>
      </div>
    </div>
  )

  if (stage === 'workspace') return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo"><Logo /><span className="auth-logo-name">Workmivo</span></div>
        <h1 className="auth-title">{T('createWorkspace')}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleCreateWorkspace}>
          <div className="field"><label>{T('companyName')}</label>
            <input type="text" value={form.name || ''} onChange={e => setF('name', e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>{saving ? T('loading') : T('createAndContinue')}</button>
        </form>
      </div>
    </div>
  )

  if (stage === 'onboarding') return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ maxWidth: 480 }}>
        <div className="auth-logo"><Logo /><span className="auth-logo-name">Workmivo</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, marginTop: 8 }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: onboardStep >= s ? 'var(--lime)' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {onboardStep === 1 && (
          <>
            <h1 className="auth-title" style={{ marginBottom: 4 }}>
              {lang === 'pt' ? 'Sua empresa' : lang === 'en' ? 'Your company' : 'Tu empresa'}
            </h1>
            <div className="auth-sub" style={{ marginBottom: 20 }}>
              {lang === 'pt' ? 'Essas informações aparecem nos seus orçamentos e faturas.' : lang === 'en' ? 'This info appears on your estimates and invoices.' : 'Esta info aparece en tus presupuestos y facturas.'}
            </div>

            {/* Logo upload */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logoPreview
                  ? <img src={logoPreview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 28 }}>🏢</span>}
              </div>
              <div>
                <label style={{ cursor: 'pointer' }}>
                  <div className="btn btn-secondary btn-sm" style={{ display: 'inline-flex' }}>
                    {lang === 'pt' ? 'Subir logo' : lang === 'en' ? 'Upload logo' : 'Subir logo'}
                  </div>
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                </label>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>PNG, JPG ou SVG</div>
              </div>
            </div>

            <div className="field"><label>{lang === 'pt' ? 'Nome da empresa' : lang === 'en' ? 'Company name' : 'Nombre de la empresa'} *</label>
              <input value={form.name || ''} onChange={e => setF('name', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{T('phone')}</label>
                <input value={form.phone || ''} onChange={e => setF('phone', e.target.value)} /></div>
              <div className="field"><label>{T('emailField')}</label>
                <input type="email" value={form.email || ''} onChange={e => setF('email', e.target.value)} /></div>
            </div>
            <div className="field"><label>{T('address')}</label>
              <input value={form.address || ''} onChange={e => setF('address', e.target.value)} /></div>
            <div className="field"><label>{lang === 'pt' ? 'CNPJ / CPF' : 'RFC / NIT / RUT'}</label>
              <input value={form.cnpj || ''} onChange={e => setF('cnpj', e.target.value)} placeholder={lang === 'pt' ? '00.000.000/0001-00' : ''} /></div>

            <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} onClick={() => { if (!form.name?.trim()) { setError(T('errorRequired')); return } setError(''); setOnboardStep(2) }}>
              {lang === 'pt' ? 'Continuar' : lang === 'en' ? 'Continue' : 'Continuar'} →
            </button>
          </>
        )}

        {onboardStep === 2 && (
          <>
            <h1 className="auth-title" style={{ marginBottom: 4 }}>
              {lang === 'pt' ? 'Preferências' : lang === 'en' ? 'Preferences' : 'Preferencias'}
            </h1>
            <div className="auth-sub" style={{ marginBottom: 20 }}>
              {lang === 'pt' ? 'Padrões usados em novos orçamentos.' : lang === 'en' ? 'Defaults used in new estimates.' : 'Valores por defecto en nuevos presupuestos.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{T('currency')}</label>
                <select value={form.currency || 'USD'} onChange={e => setF('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select></div>
              <div className="field"><label>{T('language')}</label>
                <select value={form.language || lang} onChange={e => setF('language', e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select></div>
            </div>

            <div className="field">
              <label>{lang === 'pt' ? 'Validade do orçamento (dias)' : lang === 'en' ? 'Estimate validity (days)' : 'Validez del presupuesto (días)'}</label>
              <input type="number" value={form.estimate_validity_days || 15} onChange={e => setF('estimate_validity_days', e.target.value)} min="1" /></div>

            <div className="field">
              <label>{lang === 'pt' ? 'Condições de pagamento padrão' : lang === 'en' ? 'Default payment terms' : 'Condiciones de pago por defecto'}</label>
              <input value={form.payment_terms || ''} onChange={e => setF('payment_terms', e.target.value)}
                placeholder={lang === 'pt' ? 'Ex: 50% entrada, 50% na entrega' : lang === 'en' ? 'e.g. 50% upfront, 50% on delivery' : 'Ej: 50% anticipo, 50% al finalizar'} /></div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setOnboardStep(1)}>← {lang === 'pt' ? 'Voltar' : lang === 'en' ? 'Back' : 'Volver'}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleOnboardSave} disabled={saving}>
                {saving ? (uploadingLogo ? (lang === 'pt' ? 'Subindo logo...' : 'Uploading...') : T('loading')) : (lang === 'pt' ? 'Entrar no app' : lang === 'en' ? 'Enter app' : 'Entrar al app')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ─── App ────────────────────────────────────────────────────────────────────

  const cur = company?.currency || 'USD'
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredEstimates = estimates.filter(e => (e.title + (e.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))
  const filteredJobs = jobs.filter(j => (j.title + (j.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))
  const filteredInvoices = invoices.filter(i => (i.title + (i.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))

  const navItems = [
    { id: 'dashboard', label: T('dashboard'), icon: <LayoutDashboard size={16} /> },
    { id: 'customers', label: '🧪 ' + T('customers'), icon: <Users size={16} /> },
    { id: 'estimates', label: T('estimates'), icon: <FileText size={16} /> },
    { id: 'jobs', label: T('jobs'), icon: <Briefcase size={16} /> },
    { id: 'invoices', label: T('invoices'), icon: <Receipt size={16} /> },
    { id: 'settings', label: T('settings'), icon: <Settings size={16} /> },
  ]

  const renderDashboard = () => {
    if (!limits.dashboard) return (
      <div>
        <div className="upgrade-banner">
          <p>{T('upgradeForDashboard')}</p>
        </div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="stat-card">
            <div className="stat-label">{T('totalCustomers')}</div>
            <div className="stat-value">{stats.customers}</div>
            <div className="stat-sub">{T('of')} {limits.customers}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{T('pendingEstimates')}</div>
            <div className="stat-value">{stats.pendingEst}</div>
          </div>
        </div>
      </div>
    )

    return (
      <>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">{T('totalRevenue')}</div>
            <div className="stat-value">{fCurrency(stats.paidTotal, cur)}</div>
            <div className="stat-sub">{T('invoices')} {T('paid')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{T('activeJobs')}</div>
            <div className="stat-value">{stats.activeJobs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{T('pendingEstimates')}</div>
            <div className="stat-value">{stats.pendingEst}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{T('totalCustomers')}</div>
            <div className="stat-value">{stats.customers}</div>
            {limits.customers !== Infinity && <div className="stat-sub">{T('of')} {limits.customers}</div>}
          </div>
        </div>

        {/* Revenue bar chart */}
        {(() => {
          const now = new Date()
          const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
            return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-MX' : 'en-US', { month: 'short' }) }
          })
          const data = months.map(m => ({
            label: m.label,
            value: invoices.filter(inv => inv.status === 'paid' && new Date(inv.created_at).getFullYear() === m.year && new Date(inv.created_at).getMonth() === m.month)
              .reduce((s, inv) => s + Number(inv.total), 0)
          }))
          const maxVal = Math.max(...data.map(d => d.value), 1)
          const chartH = 80
          return (
            <div className="table-wrap" style={{ padding: '16px 20px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {T('totalRevenue')} — {T('paid')}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: chartH + 20 }}>
                {data.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                      {d.value > 0 ? fCurrency(d.value, cur).replace(/\.00$/, '') : ''}
                    </div>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: Math.max(4, (d.value / maxVal) * chartH),
                      background: i === 5 ? 'var(--lime)' : 'var(--dark3)',
                      transition: 'height 0.3s ease'
                    }} />
                    <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'capitalize' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="table-wrap">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
              {T('estimates')} — {T('sent')} / {T('viewed')}
            </div>
            <table>
              <tbody>
                {estimates.filter(e => ['sent','viewed'].includes(e.status)).slice(0, 5).map(e => (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td><Badge status={e.status} label={T(e.status)} /></td>
                    <td style={{ textAlign: 'right' }}>{fCurrency(e.total, cur)}</td>
                  </tr>
                ))}
                {!estimates.filter(e => ['sent','viewed'].includes(e.status)).length && (
                  <EmptyState icon="📋" title={T('noData')} sub={T('noEstimates')} />
                )}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
              {T('jobs')} — {T('in_progress')}
            </div>
            <table>
              <tbody>
                {jobs.filter(j => j.status === 'in_progress').slice(0, 5).map(j => (
                  <tr key={j.id}>
                    <td>{j.title}</td>
                    <td>{j.customers?.name || '—'}</td>
                    <td>{fDate(j.scheduled_date)}</td>
                  </tr>
                ))}
                {!jobs.filter(j => j.status === 'in_progress').length && (
                  <EmptyState icon="🔧" title={T('noData')} sub={T('noJobs')} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  const renderCustomers = () => (
    <div className="table-wrap">
      <div className="table-search">
        <input placeholder={T('search')} value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 'auto' }}>
          {customers.length}{limits.customers !== Infinity ? `/${limits.customers}` : ''}
        </span>
      </div>
      <table>
        <thead><tr>
          <th>{T('name')}</th><th>{T('emailField')}</th><th>{T('phone')}</th><th>{T('language')}</th><th></th>
        </tr></thead>
        <tbody>
          {filteredCustomers.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={c.name} size={30} />
                  {c.name}
                </div>
              </td>
              <td style={{ color: 'var(--text2)' }}>{c.email || '—'}</td>
              <td style={{ color: 'var(--text2)' }}>{c.phone || '—'}</td>
              <td><span style={{ fontSize: 12, background: 'var(--dark3)', padding: '2px 8px', borderRadius: 4 }}>{c.language?.toUpperCase()}</span></td>
              <td><div className="td-actions">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openModal('customers', c)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ table: 'customers', id: c.id })}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
          {!filteredCustomers.length && <EmptyState icon="👥" title={T('noCustomers')} sub={lang === 'es' ? 'Agrega tu primer cliente para comenzar.' : lang === 'pt' ? 'Adicione seu primeiro cliente para começar.' : 'Add your first customer to get started.'} />}
        </tbody>
      </table>
    </div>
  )

  const renderEstimates = () => (
    <div className="table-wrap">
      <div className="table-search">
        <input placeholder={T('search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <table>
        <thead><tr>
          <th>{T('title')}</th><th>{T('customer')}</th><th>{T('status')}</th><th>{T('total')}</th><th>{T('createdAt')}</th><th></th>
        </tr></thead>
        <tbody>
          {filteredEstimates.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500 }}>{e.title}</td>
              <td style={{ color: 'var(--text2)' }}>{e.customers?.name || '—'}</td>
              <td>
                <select className="status-select" value={e.status}
                  style={{ background: `${STATUS_COLOR[e.status]}22`, color: STATUS_COLOR[e.status] }}
                  onChange={ev => quickStatus('estimates', e.id, ev.target.value)}>
                  {ESTIMATE_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
                </select>
              </td>
              <td style={{ fontWeight: 600 }}>{fCurrency(e.total, cur)}</td>
              <td style={{ color: 'var(--text2)', fontSize: 13 }}>{fDate(e.created_at)}</td>
              <td><div className="td-actions">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openModal('estimates', e)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ table: 'estimates', id: e.id })}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
          {!filteredEstimates.length && <EmptyState icon="📋" title={T('noEstimates')} sub={lang === 'es' ? 'Crea tu primer presupuesto.' : lang === 'pt' ? 'Crie seu primeiro orçamento.' : 'Create your first estimate.'} />}
        </tbody>
      </table>
    </div>
  )

  const renderJobs = () => (
    <div className="table-wrap">
      <div className="table-search">
        <input placeholder={T('search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <table>
        <thead><tr>
          <th>{T('title')}</th><th>{T('customer')}</th><th>{T('status')}</th><th>{T('scheduledDate')}</th><th></th>
        </tr></thead>
        <tbody>
          {filteredJobs.map(j => (
            <tr key={j.id}>
              <td style={{ fontWeight: 500 }}>{j.title}</td>
              <td style={{ color: 'var(--text2)' }}>{j.customers?.name || '—'}</td>
              <td>
                <select className="status-select" value={j.status}
                  style={{ background: `${STATUS_COLOR[j.status]}22`, color: STATUS_COLOR[j.status] }}
                  onChange={ev => quickStatus('jobs', j.id, ev.target.value)}>
                  {JOB_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
                </select>
              </td>
              <td style={{ color: 'var(--text2)', fontSize: 13 }}>{fDate(j.scheduled_date)}</td>
              <td><div className="td-actions">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openModal('jobs', j)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ table: 'jobs', id: j.id })}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
          {!filteredJobs.length && <EmptyState icon="🔧" title={T('noJobs')} sub={lang === 'es' ? 'Ningún trabajo programado aún.' : lang === 'pt' ? 'Nenhum trabalho agendado ainda.' : 'No jobs scheduled yet.'} />}
        </tbody>
      </table>
    </div>
  )

  const renderInvoices = () => (
    <div className="table-wrap">
      <div className="table-search">
        <input placeholder={T('search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <table>
        <thead><tr>
          <th>{T('title')}</th><th>{T('customer')}</th><th>{T('status')}</th><th>{T('total')}</th><th>{T('dueDate')}</th><th></th>
        </tr></thead>
        <tbody>
          {filteredInvoices.map(inv => (
            <tr key={inv.id}>
              <td style={{ fontWeight: 500 }}>{inv.title}</td>
              <td style={{ color: 'var(--text2)' }}>{inv.customers?.name || '—'}</td>
              <td>
                <select className="status-select" value={inv.status}
                  style={{ background: `${STATUS_COLOR[inv.status]}22`, color: STATUS_COLOR[inv.status] }}
                  onChange={ev => quickStatus('invoices', inv.id, ev.target.value)}>
                  {INVOICE_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
                </select>
              </td>
              <td style={{ fontWeight: 600 }}>{fCurrency(inv.total, cur)}</td>
              <td style={{ color: 'var(--text2)', fontSize: 13 }}>{fDate(inv.due_date)}</td>
              <td><div className="td-actions">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openModal('invoices', inv)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ table: 'invoices', id: inv.id })}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
          {!filteredInvoices.length && <EmptyState icon="🧾" title={T('noInvoices')} sub={lang === 'es' ? 'Ninguna factura creada aún.' : lang === 'pt' ? 'Nenhuma fatura criada ainda.' : 'No invoices created yet.'} />}
        </tbody>
      </table>
    </div>
  )

  const renderSettings = () => (
    <div style={{ maxWidth: 540 }}>
      <div className="table-wrap" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>{T('companySettings')}</h3>
        {msg && <div className="alert alert-success">{msg}</div>}
        <div className="field"><label>{T('companyName')}</label>
          <input value={form.name || company?.name || ''} onChange={e => setF('name', e.target.value)} /></div>
        <div className="field"><label>{T('emailField')}</label>
          <input type="email" value={form.email || company?.email || ''} onChange={e => setF('email', e.target.value)} /></div>
        <div className="field"><label>{T('phone')}</label>
          <input value={form.phone || company?.phone || ''} onChange={e => setF('phone', e.target.value)} /></div>
        <div className="field"><label>{T('address')}</label>
          <input value={form.address || company?.address || ''} onChange={e => setF('address', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>{T('currency')}</label>
            <select value={form.currency || company?.currency || 'USD'} onChange={e => setF('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>{T('language')}</label>
            <select value={form.language || company?.language || 'es'} onChange={e => setF('language', e.target.value)}>
              {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            {T('plan')}: <strong style={{ color: 'var(--lime)' }}>{T(plan)}</strong>
          </div>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving ? T('loading') : T('save')}</button>
        </div>
      </div>
    </div>
  )

  // ─── Modal Customer ──────────────────────────────────────────────────────────
  const renderModalCustomer = () => (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? T('edit') : T('newF')} {T('customer')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>{T('name')} *</label>
            <input value={form.name || ''} onChange={e => setF('name', e.target.value)} autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>{T('emailField')}</label>
              <input type="email" value={form.email || ''} onChange={e => setF('email', e.target.value)} /></div>
            <div className="field"><label>{T('phone')}</label>
              <input value={form.phone || ''} onChange={e => setF('phone', e.target.value)} /></div>
          </div>
          <div className="field"><label>{T('address')}</label>
            <input value={form.address || ''} onChange={e => setF('address', e.target.value)} /></div>
          <div className="field"><label>{T('language')}</label>
            <select value={form.language || 'es'} onChange={e => setF('language', e.target.value)}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select></div>
          <div className="field"><label>{T('notes')}</label>
            <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={closeModal}>{T('cancel')}</button>
          <button className="btn btn-primary" onClick={saveCustomer} disabled={saving}>{saving ? T('loading') : T('save')}</button>
        </div>
      </div>
    </div>
  )

  // ─── Modal Estimate ──────────────────────────────────────────────────────────
  const renderModalEstimate = () => {
    const sub = Number(form.subtotal) || 0
    const disc = Number(form.discount) || 0
    const tax = Number(form.tax) || 0
    const total = sub - disc + tax

    return (
      <div className="modal-backdrop" onClick={closeModal}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h2>{editing ? T('edit') : T('newF')} {T('estimate')}</h2>
            <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{T('title')} *</label>
                <input value={form.title || ''} onChange={e => setF('title', e.target.value)} autoFocus /></div>
              <div className="field"><label>{T('customer')}</label>
                <InlineNewCustomer value={form.customer_id} onChange={v => setF('customer_id', v)} customers={customers} inlineCustomer={inlineCustomer} setInlineCustomer={setInlineCustomer} saveInlineCustomer={saveInlineCustomer} savingCustomer={savingCustomer} lang={lang} />
              </div>
            </div>
            <div className="field"><label>{T('description')}</label>
              <textarea value={form.description || ''} onChange={e => setF('description', e.target.value)} style={{ minHeight: 60 }} /></div>

            {/* Line items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>{T('items')}</div>
              <table className="items-table">
                <thead><tr>
                  <th style={{ width: '45%' }}>{T('itemDescription')}</th>
                  <th style={{ width: '15%' }}>{T('quantity')}</th>
                  <th style={{ width: '20%' }}>{T('unitPrice')}</th>
                  <th style={{ width: '15%' }}>{T('total')}</th>
                  <th style={{ width: '5%' }}></th>
                </tr></thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id}>
                      <td><input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder={T('itemDescription')} /></td>
                      <td><input type="number" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="0" step="0.01" /></td>
                      <td><input type="number" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} min="0" step="0.01" /></td>
                      <td><span className="item-total">{fCurrency((Number(it.quantity)||0)*(Number(it.unit_price)||0), cur)}</span></td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeItem(idx)}><Trash size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> {T('addItem')}</button>
            </div>

            {/* Totals */}
            <div className="totals-box">
              <div className="totals-row"><span>{T('subtotal')}</span><span>{fCurrency(sub, cur)}</span></div>
              <div className="totals-row">
                <span>{T('discount')}</span>
                <input type="number" value={form.discount || ''} onChange={e => { setF('discount', e.target.value); const {subtotal,total} = calcTotals(items, e.target.value, form.tax); setForm(f=>({...f,discount:e.target.value,subtotal,total})) }}
                  style={{ width: 80, background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }} min="0" step="0.01" placeholder="0" />
              </div>
              <div className="totals-row">
                <span>{T('tax')}</span>
                <input type="number" value={form.tax || ''} onChange={e => { const {subtotal,total} = calcTotals(items, form.discount, e.target.value); setForm(f=>({...f,tax:e.target.value,subtotal,total})) }}
                  style={{ width: 80, background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }} min="0" step="0.01" placeholder="0" />
              </div>
              <div className="totals-row grand"><span>{T('total')}</span><span>{fCurrency(Math.max(0,total), cur)}</span></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div className="field"><label>{T('status')}</label>
                <select value={form.status || 'draft'} onChange={e => setF('status', e.target.value)}>
                  {ESTIMATE_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
                </select></div>
            </div>
            <div className="field"><label>{T('notes')}</label>
              <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} style={{ minHeight: 56 }} /></div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={closeModal}>{T('cancel')}</button>
            <button className="btn btn-primary" onClick={saveEstimate} disabled={saving}>{saving ? T('loading') : T('save')}</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Modal Job ───────────────────────────────────────────────────────────────
  const renderModalJob = () => (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? T('edit') : T('new')} {T('job')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>{T('title')} *</label>
            <input value={form.title || ''} onChange={e => setF('title', e.target.value)} autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>{T('customer')}</label>
              <InlineNewCustomer value={form.customer_id} onChange={v => setF('customer_id', v)} customers={customers} inlineCustomer={inlineCustomer} setInlineCustomer={setInlineCustomer} saveInlineCustomer={saveInlineCustomer} savingCustomer={savingCustomer} lang={lang} />
            </div>
            <div className="field"><label>{T('status')}</label>
              <select value={form.status || 'scheduled'} onChange={e => setF('status', e.target.value)}>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
              </select></div>
          </div>
          <div className="field"><label>{T('scheduledDate')}</label>
            <input type="date" value={form.scheduled_date || ''} onChange={e => setF('scheduled_date', e.target.value)} /></div>
          <div className="field"><label>{T('description')}</label>
            <textarea value={form.description || ''} onChange={e => setF('description', e.target.value)} /></div>
          <div className="field"><label>{T('fromEstimate')}</label>
            <select value={form.estimate_id || ''} onChange={e => setF('estimate_id', e.target.value)}>
              <option value="">—</option>
              {estimates.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select></div>
          <div className="field"><label>{T('notes')}</label>
            <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} style={{ minHeight: 56 }} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={closeModal}>{T('cancel')}</button>
          <button className="btn btn-primary" onClick={saveJob} disabled={saving}>{saving ? T('loading') : T('save')}</button>
        </div>
      </div>
    </div>
  )

  // ─── Modal Invoice ───────────────────────────────────────────────────────────
  const renderModalInvoice = () => (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? T('edit') : T('newF')} {T('invoice')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field"><label>{T('title')} *</label>
            <input value={form.title || ''} onChange={e => setF('title', e.target.value)} autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>{T('customer')}</label>
              <InlineNewCustomer value={form.customer_id} onChange={v => setF('customer_id', v)} customers={customers} inlineCustomer={inlineCustomer} setInlineCustomer={setInlineCustomer} saveInlineCustomer={saveInlineCustomer} savingCustomer={savingCustomer} lang={lang} />
            </div>
            <div className="field"><label>{T('status')}</label>
              <select value={form.status || 'draft'} onChange={e => setF('status', e.target.value)}>
                {INVOICE_STATUSES.map(s => <option key={s} value={s}>{T(s)}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field"><label>{T('subtotal')}</label>
              <input type="number" value={form.subtotal || ''} onChange={e => { const v=Number(e.target.value); setForm(f=>({...f,subtotal:v,total:Math.max(0,v-(Number(f.discount)||0)+(Number(f.tax)||0))})) }} min="0" step="0.01" /></div>
            <div className="field"><label>{T('discount')}</label>
              <input type="number" value={form.discount || ''} onChange={e => { const v=Number(e.target.value); setForm(f=>({...f,discount:v,total:Math.max(0,(Number(f.subtotal)||0)-v+(Number(f.tax)||0))})) }} min="0" step="0.01" /></div>
            <div className="field"><label>{T('tax')}</label>
              <input type="number" value={form.tax || ''} onChange={e => { const v=Number(e.target.value); setForm(f=>({...f,tax:v,total:Math.max(0,(Number(f.subtotal)||0)-(Number(f.discount)||0)+v)})) }} min="0" step="0.01" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label style={{ color: 'var(--lime)' }}>{T('total')}</label>
              <input type="number" value={form.total || ''} onChange={e => setF('total', e.target.value)} min="0" step="0.01" style={{ fontWeight: 700, color: 'var(--lime)' }} /></div>
            <div className="field"><label>{T('dueDate')}</label>
              <input type="date" value={form.due_date || ''} onChange={e => setF('due_date', e.target.value)} /></div>
          </div>
          <div className="field"><label>{T('fromEstimate')}</label>
            <select value={form.estimate_id || ''} onChange={e => setF('estimate_id', e.target.value)}>
              <option value="">—</option>
              {estimates.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select></div>
          <div className="field"><label>{T('notes')}</label>
            <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} style={{ minHeight: 56 }} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={closeModal}>{T('cancel')}</button>
          <button className="btn btn-primary" onClick={saveInvoice} disabled={saving}>{saving ? T('loading') : T('save')}</button>
        </div>
      </div>
    </div>
  )

  const topbarAction = () => {
    if (page === 'settings' || page === 'dashboard') return null
    const canAdd = page === 'customers' ? customers.length < limits.customers : true
    const labels = { customers: T('customer'), estimates: T('estimate'), jobs: T('job'), invoices: T('invoice') }
    return (
      <button className="btn btn-primary btn-sm" onClick={() => { if (!canAdd) return; openModal(page); setSearch('') }}
        disabled={!canAdd} title={!canAdd ? T('limitReached') : ''}>
        <Plus size={14} /> {T('new')} {labels[page]}
      </button>
    )
  }

  return (
    <div className="app-wrap">
      {/* Overlay mobile */}
      <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Workmivo" style={{ height: 32, objectFit: 'contain' }} />
        {company?.logo_url && (
          <img src={company.logo_url} alt={company.name} style={{ height: 28, objectFit: 'contain', marginLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 8, maxWidth: 80 }} />
        )}
      </div>
        <nav className="sidebar-nav">
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => { setPage(n.id); setSidebarOpen(false); setSearch(''); if (n.id === 'settings') setForm({}) }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-plan">{T('plan')}: <strong>{T(plan)}</strong></div>
          <div className="lang-switch" style={{ marginBottom: 8 }}>
            {LANGS.map(l => (
              <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => changeLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }} onClick={handleLogout}>
            <LogOut size={14} /> {T('logout')}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
            <span className="topbar-title">{navItems.find(n => n.id === page)?.label}</span>
          </div>
          <div className="topbar-actions">{topbarAction()}</div>
        </div>

        <div className="content">
          {page === 'dashboard' && renderDashboard()}
          {page === 'customers' && renderCustomers()}
          {page === 'estimates' && renderEstimates()}
          {page === 'jobs' && renderJobs()}
          {page === 'invoices' && renderInvoices()}
          {page === 'settings' && renderSettings()}
        </div>
      </main>

      {/* Modals */}
      {modal === 'customers' && renderModalCustomer()}
      {modal === 'estimates' && renderModalEstimate()}
      {modal === 'jobs' && renderModalJob()}
      {modal === 'invoices' && renderModalInvoice()}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="confirm-box">
            <p>{T('confirmDelete')}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>{T('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDelete}>{T('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
