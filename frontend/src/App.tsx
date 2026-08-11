import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Deadlines from './pages/Deadlines'
import Contracts from './pages/Contracts'
import BrandLogo from './components/BrandLogo'
import {
  authApi,
  documentsApi,
  deadlinesApi,
  contractsApi,
  notificationsApi,
  getAccessToken,
} from './services/api'
import type { Document, Deadline, DocumentType, Contract, RenewalType, User, Notification } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  async function loadData() {
    const [docs, dls, ctrs, notifs] = await Promise.all([
      documentsApi.list(),
      deadlinesApi.list(),
      contractsApi.list(),
      notificationsApi.list(),
    ])
    setDocuments(docs)
    setDeadlines(dls)
    setContracts(ctrs)
    setNotifications(notifs)
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
