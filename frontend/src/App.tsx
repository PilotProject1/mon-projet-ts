import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Deadlines from './pages/Deadlines'
import { mockDocuments, mockDeadlines } from './services/mockData'
import type { Document, Deadline } from './types'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [documents, setDocuments] = useState<Document[]>(mockDocuments)
  const [deadlines, setDeadlines] = useState<Deadline[]>(mockDeadlines)

  function addDocument(doc: Document) {
    setDocuments((prev) => [doc, ...prev])
  }

  function deleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  function addDeadline(deadline: Deadline) {
    setDeadlines((prev) => [deadline, ...prev])
  }

  function toggleDeadlineStatus(id: string) {
    setDeadlines((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: d.status === 'terminee' ? 'a_faire' : 'terminee' } : d,
      ),
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/connexion"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/inscription"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Register onLogin={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          element={
            isAuthenticated ? (
              <Layout onLogout={() => setIsAuthenticated(false)} />
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
