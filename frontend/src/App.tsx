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
import BrandLogo from './components/BrandLogo'
import {
  authApi,
  documentsApi,
  deadlinesApi,
  contractsApi,
  notificationsApi,
  sharesApi,
  getAccessToken,
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
} from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [shares, setShares] = useState<ShareLink[]>([])

  async function loadData() {
    const [docs, dls, ctrs, notifs, shrs] = await Promise.all([
      documentsApi.list(),
      deadlinesApi.list(),
      contractsApi.list(),
      notificationsApi.list(),
      sharesApi.list(),
    ])
    setDocuments(docs)
    setDeadlines(dls)
    setContracts(ctrs)
    setNotifications(notifs)
    setShares(shrs)
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
  }

  async function addDocument(data: { name: string; type: DocumentType; file: File }) {
    const doc = await documentsApi.create(data)
    setDocuments((prev) => [doc, ...prev])
  }

  async function deleteDocument(id: string) {
    await documentsApi.remove(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  async function addDeadline(data: { title: string; dueDate: string; documentId?: string }) {
    const deadline = await deadlinesApi.create(data)
    setDeadlines((prev) => [deadline, ...prev])
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
    setNotifications((prev) => [notification, ...prev])
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
            isAuthenticated ? (
              <Layout
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
          <Route
            path="/documents"
            element={
              <Documents
                documents={documents}
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
