import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Deadlines from './pages/Deadlines'
import Contracts from './pages/Contracts'
import Shares from './pages/Shares'
import PublicShare from './pages/PublicShare'
import CompanyPage from './pages/Company'
import Clients from './pages/Clients'
import Invoices from './pages/Invoices'
import Search from './pages/Search'
import Abonnement from './pages/Abonnement'
import MentionsLegales from './pages/MentionsLegales'
import Confidentialite from './pages/Confidentialite'
import Cgv from './pages/Cgv'
import BrandLogo from './components/BrandLogo'
import {
  authApi,
  documentsApi,
  deadlinesApi,
  contractsApi,
  notificationsApi,
  sharesApi,
  companyApi,
  clientsApi,
  invoicesApi,
  getAccessToken,
  ApiError,
  planApi,
} from './services/api'
import type {
  Document,
  Deadline,
  DocumentType,
  Contract,
  RenewalType,
  User,
  Notification,
  ShareLink,
  Company,
  Client,
  Invoice,
  InvoiceStatus,
  PlanUsage,
} from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [shares, setShares] = useState<ShareLink[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null)

  async function loadData() {
    const [docs, dls, ctrs, notifs, shrs, plan] = await Promise.all([
      documentsApi.list(),
      deadlinesApi.list(),
      contractsApi.list(),
      notificationsApi.list(),
      sharesApi.list(),
      planApi.get(),
    ])
    setPlanUsage(plan)
    setDocuments(docs)
    setDeadlines(dls)
    setContracts(ctrs)
    setNotifications(notifs)
    setShares(shrs)

    let comp: Company | null = null
    try {
      comp = await companyApi.get()
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    setCompany(comp)

    if (comp) {
      const [clnts, invs] = await Promise.all([clientsApi.list(), invoicesApi.list()])
      setClients(clnts)
      setInvoices(invs)
    } else {
      setClients([])
      setInvoices([])
    }
  }

  useEffect(() => {
    async function restoreSession() {
      if (getAccessToken()) {
        try {
          const currentUser = await authApi.me()
          setUser(currentUser)
          await loadData()
        } catch {
          authApi.logout()
        }
      }
      setCheckingSession(false)
    }
    restoreSession()
  }, [])

  async function handleLogin(loggedInUser: User) {
    setUser(loggedInUser)
    await loadData()
  }

  function handleLogout() {
    authApi.logout()
    setUser(null)
    setDocuments([])
    setDeadlines([])
    setContracts([])
    setNotifications([])
    setShares([])
    setCompany(null)
    setPlanUsage(null)
    setClients([])
    setInvoices([])
  }

  /** Le quota dépend du nombre de documents : il est relu après chaque ajout/suppression. */
  async function refreshPlanUsage() {
    setPlanUsage(await planApi.get())
  }

  async function addDocument(data: { name: string; type: DocumentType; file: File }) {
    const doc = await documentsApi.create(data)
    setDocuments((prev) => [doc, ...prev])
    await refreshPlanUsage()
  }

  async function deleteDocument(id: string) {
    await documentsApi.remove(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    await refreshPlanUsage()
  }

  async function addDeadline(data: { title: string; dueDate: string; documentId?: string }) {
    const deadline = await deadlinesApi.create(data)
    setDeadlines((prev) => [deadline, ...prev])
  }

  async function deleteDeadline(id: string) {
    await deadlinesApi.remove(id)
    setDeadlines((prev) => prev.filter((d) => d.id !== id))
  }

  async function toggleDeadlineStatus(id: string) {
    const current = deadlines.find((d) => d.id === id)
    if (!current) return
    const updated = await deadlinesApi.updateStatus(
      id,
      current.status === 'terminee' ? 'a_faire' : 'terminee',
    )
    setDeadlines((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  async function sendReminder(id: string) {
    const notification = await deadlinesApi.remind(id)
    // Le serveur ne renvoie rien lorsqu'un rappel identique existe déjà.
    if (notification) setNotifications((prev) => [notification, ...prev])
  }

  async function addContract(data: {
    provider: string
    startDate: string
    endDate: string
    amount: number
    renewalType: RenewalType
    documentId: string
  }) {
    const contract = await contractsApi.create(data)
    setContracts((prev) => [contract, ...prev])
  }

  async function deleteContract(id: string) {
    await contractsApi.remove(id)
    setContracts((prev) => prev.filter((c) => c.id !== id))
  }

  async function markNotificationRead(id: string) {
    const updated = await notificationsApi.markRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)))
  }

  async function createShare(data: { documentId: string; expiresInHours: 24 | 168 | 720 }) {
    const share = await sharesApi.create(data)
    setShares((prev) => [share, ...prev])
    return share
  }

  async function revokeShare(id: string) {
    await sharesApi.revoke(id)
    setShares((prev) =>
      prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s)),
    )
  }

  async function createCompany(data: { name: string; legalInfo?: string }) {
    const created = await companyApi.create(data)
    setCompany(created)
  }

  async function updateCompany(data: { name?: string; legalInfo?: string }) {
    const updated = await companyApi.update(data)
    setCompany(updated)
  }

  async function addClient(data: { name: string; email: string; phone?: string }) {
    const client = await clientsApi.create(data)
    setClients((prev) => [client, ...prev])
  }

  async function deleteClient(id: string) {
    await clientsApi.remove(id)
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  async function addInvoice(data: { clientId: string; total: number; dueDate: string }) {
    const invoice = await invoicesApi.create(data)
    setInvoices((prev) => [invoice, ...prev])
  }

  async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
    const updated = await invoicesApi.updateStatus(id, status)
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  async function deleteInvoice(id: string) {
    await invoicesApi.remove(id)
    setInvoices((prev) => prev.filter((i) => i.id !== id))
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-brand-mint">
        <div className="animate-pulse">
          <BrandLogo iconSize={40} wordmarkClassName="text-xl" />
        </div>
        <p className="text-sm text-brand-muted">Chargement...</p>
      </div>
    )
  }

  const isAuthenticated = !!user

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/partage/:token" element={<PublicShare />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/cgv" element={<Cgv />} />
        <Route
          path="/connexion"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/inscription"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Register onLogin={handleLogin} />
          }
        />
        <Route
          element={
            user ? (
              <Layout
                user={user}
                planUsage={planUsage}
                onLogout={handleLogout}
                notifications={notifications}
                onMarkRead={markNotificationRead}
              />
            ) : (
              <Navigate to="/connexion" replace />
            )
          }
        >
          <Route path="/" element={<Dashboard documents={documents} deadlines={deadlines} />} />
          <Route path="/recherche" element={<Search />} />
          <Route
            path="/abonnement"
            element={<Abonnement planUsage={planUsage} onPlanChanged={refreshPlanUsage} />}
          />
          <Route
            path="/documents"
            element={
              <Documents
                documents={documents}
                planUsage={planUsage}
                onAdd={addDocument}
                onDelete={deleteDocument}
                onCreateDeadline={addDeadline}
                onCreateContract={addContract}
                onCreateShare={createShare}
              />
            }
          />
          <Route
            path="/echeances"
            element={
              <Deadlines
                deadlines={deadlines}
                documents={documents}
                onAdd={addDeadline}
                onDelete={deleteDeadline}
                onToggleStatus={toggleDeadlineStatus}
                onRemind={sendReminder}
              />
            }
          />
          <Route
            path="/contrats"
            element={
              <Contracts
                contracts={contracts}
                documents={documents}
                onAdd={addContract}
                onDelete={deleteContract}
              />
            }
          />
          <Route
            path="/partages"
            element={<Shares shares={shares} onRevoke={revokeShare} />}
          />
          <Route
            path="/entreprise"
            element={
              <CompanyPage company={company} onCreate={createCompany} onUpdate={updateCompany} />
            }
          />
          <Route
            path="/clients"
            element={
              <Clients
                company={company}
                clients={clients}
                onAdd={addClient}
                onDelete={deleteClient}
              />
            }
          />
          <Route
            path="/factures"
            element={
              <Invoices
                company={company}
                clients={clients}
                invoices={invoices}
                onAdd={addInvoice}
                onUpdateStatus={updateInvoiceStatus}
                onDelete={deleteInvoice}
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
