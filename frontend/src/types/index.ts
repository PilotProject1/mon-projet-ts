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

export type RenewalType = 'tacite' | 'manuel' | 'aucun'

export interface Contract {
  id: string
  userId: string
  documentId: string
  provider: string
  startDate: string
  endDate: string
  amount: number
  renewalType: RenewalType
  createdAt: string
}

export interface DocumentAnalysis {
  warning: string | null
  rawTextPreview: string
  suggestedType: DocumentType | null
  suggestedProvider: string | null
  suggestedDates: string[]
  suggestedAmount: number | null
}

export interface ShareLink {
  id: string
  token: string
  documentId: string
  documentName: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  accessCount: number
}

export interface PublicShareInfo {
  documentName: string
  documentType: DocumentType
  mimeType: string
  expiresAt: string
}

export interface Notification {
  id: string
  userId: string
  deadlineId: string
  channel: string
  status: 'envoyee' | 'echouee'
  message: string
  sentAt: string
  readAt: string | null
}

export interface Company {
  id: string
  ownerId: string
  name: string
  legalInfo: string | null
  createdAt: string
}

export interface Client {
  id: string
  companyId: string
  name: string
  email: string
  phone: string | null
}

export type InvoiceStatus = 'brouillon' | 'envoyee' | 'payee' | 'en_retard'

export interface Invoice {
  id: string
  companyId: string
  clientId: string
  clientName: string
  number: string
  total: number
  dueDate: string
  status: InvoiceStatus
  createdAt: string
}

export type SearchKind = 'document' | 'deadline' | 'contract' | 'invoice'

export interface SearchHit {
  kind: SearchKind
  reason: string
  item: Record<string, unknown>
}

export interface SearchAnswer {
  summary: string
  results: SearchHit[]
}

export type Plan = 'gratuit' | 'premium' | 'pro' | 'pme'
export type PlanFeature = 'ia' | 'partage' | 'facturation' | 'equipes'

export interface PlanUsage {
  plan: Plan
  label: string
  monthlyPrice: number
  features: PlanFeature[]
  documents: {
    used: number
    /** null = illimité */
    max: number | null
    remaining: number | null
  }
}
