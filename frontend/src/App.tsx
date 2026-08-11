import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Deadlines from './pages/Deadlines'
import { authApi, documentsApi, deadlinesApi, getAccessToken } from './services/api'
import type { Document, Deadline, DocumentType, DeadlinePriority, User } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])

  async function loadData() {
    const [docs, dls] = await Promise.all([documentsApi.list(), deadlinesApi.list()])
    setDocuments(docs)
    setDeadlines(dls)
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
  }

  async function addDocument(data: { name: string; type: DocumentType; fileUrl: string }) {
    const doc = await documentsApi.create(data)
    setDocuments((prev) => [doc, ...prev])
  }

  async function deleteDocument(id: string) {
    await documentsApi.remove(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  async function addDeadline(data: {
    title: string
    dueDate: string
    priority: DeadlinePriority
    documentId?: string
  }) {
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

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        Chargement...
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
              <Layout onLogout={handleLogout} />
            ) : (
              <Navigate to="/connexion" replace />
            )
          }
        >
          <Route path="/" element={<Dashboard documents={documents} deadlines={deadlines} />} />
          <Route
            path="/documents"
            element={
              <Documents documents={documents} onAdd={addDocument} onDelete={deleteDocument} />
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
