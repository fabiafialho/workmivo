'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/translations'
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
  const [stage, setStage] = useState('loading')  // loading|login|register|forgot|workspace|app
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
      setStage('app')
      await loadData(co.id)
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
    setCompany(co); setPlan('basico'); setStage('app'); setSaving(false)
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

  const closeModal = () => { setModal(null); setEditing(null); setForm({}); setItems([newItem()]); setError('') }

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

  // ─── Renders ─────────────────────────────────────────────────────────────────

  if (stage === 'loading') return (
    <div className="auth-wrap"><p style={{ color: 'var(--text2)' }}>{T('loading')}</p></div>
  )

  if (stage === 'login') return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">Workmivo</div>
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
        <div className="auth-logo">Workmivo</div>
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
        <div className="auth-logo">Workmivo</div>
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
        <div className="auth-logo">Workmivo</div>
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

  // ─── App ────────────────────────────────────────────────────────────────────

  const cur = company?.currency || 'USD'
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredEstimates = estimates.filter(e => (e.title + (e.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))
  const filteredJobs = jobs.filter(j => (j.title + (j.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))
  const filteredInvoices = invoices.filter(i => (i.title + (i.customers?.name || '')).toLowerCase().includes(search.toLowerCase()))

  const navItems = [
    { id: 'dashboard', label: T('dashboard'), icon: <LayoutDashboard size={16} /> },
    { id: 'customers', label: T('customers'), icon: <Users size={16} /> },
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
                  <tr className="empty-row"><td colSpan={3}>{T('noData')}</td></tr>
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
                  <tr className="empty-row"><td colSpan={3}>{T('noData')}</td></tr>
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
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td style={{ color: 'var(--text2)' }}>{c.email || '—'}</td>
              <td style={{ color: 'var(--text2)' }}>{c.phone || '—'}</td>
              <td><span style={{ fontSize: 12, background: 'var(--dark3)', padding: '2px 8px', borderRadius: 4 }}>{c.language?.toUpperCase()}</span></td>
              <td><div className="td-actions">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openModal('customers', c)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ table: 'customers', id: c.id })}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
          {!filteredCustomers.length && <tr className="empty-row"><td colSpan={5}>{T('noCustomers')}</td></tr>}
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
          {!filteredEstimates.length && <tr className="empty-row"><td colSpan={6}>{T('noEstimates')}</td></tr>}
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
          {!filteredJobs.length && <tr className="empty-row"><td colSpan={5}>{T('noJobs')}</td></tr>}
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
          {!filteredInvoices.length && <tr className="empty-row"><td colSpan={6}>{T('noInvoices')}</td></tr>}
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
                <select value={form.customer_id || ''} onChange={e => setF('customer_id', e.target.value)}>
                  <option value="">—</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
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
              <select value={form.customer_id || ''} onChange={e => setF('customer_id', e.target.value)}>
                <option value="">—</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
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
              <select value={form.customer_id || ''} onChange={e => setF('customer_id', e.target.value)}>
                <option value="">—</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
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
    if (page === 'settings') return null
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
          Workmivo
          <span>{company?.name}</span>
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
