export type DocumentType = 'contrat' | 'facture' | 'assurance' | 'garantie' | 'courrier' | 'autre'

export interface Document {
  id: string
  userId: string
  name: string
  type: DocumentType
  fileKey: string
  mimeType: string
  sizeBytes: number
  status: 'traite' | 'en_attente'
  createdAt: string
}

export type DeadlinePriority = 'basse' | 'moyenne' | 'haute'
export type DeadlineStatus = 'a_faire' | 'terminee'

export interface Deadline {
  id: string
  userId: string
  documentId: string | null
  title: string
  dueDate: string
  priority: DeadlinePriority
  status: DeadlineStatus
}

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}
