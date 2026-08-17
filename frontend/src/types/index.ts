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
  /** Échéance repérée dans le document, tant qu'elle n'a pas été tranchée. */
  suggestedDueDate: string | null
  /** Formule du document qui désigne cette échéance. */
  suggestedDueLabel: string | null
  /** Émetteur reconnu dans le document (EDF, MAIF…), null si non identifié. */
  provider: string | null
  /** Montant principal lu dans le document, en euros. */
  amount: number | null
  /** Date portée par le document, à distinguer de la date de dépôt. */
  documentDate: string | null
  /** Numéro de facture, de contrat ou de police porté par le document. */
  reference: string | null
  /** Intitulé qui l'annonce, pour savoir de quelle référence il s'agit. */
  referenceLabel: string | null
  /** true réglé, false encore dû, null si le document ne tranche pas. */
  paid: boolean | null
  /** Date de la dernière lecture. null tant que le document n'a pas été lu. */
  analyzedAt: string | null
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
  suggestedDocumentDate: string | null
  /** Numéro de facture, de contrat ou de police porté par le document. */
  suggestedReference: string | null
  /** Intitulé qui l'annonce, pour savoir de quelle référence il s'agit. */
  suggestedReferenceLabel: string | null
  /** true réglé, false encore dû, null si le document ne tranche pas. */
  suggestedPaid: boolean | null
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

export interface NotificationPreferences {
  /** Rappels d'échéance envoyés par e-mail. */
  emailReminders: boolean
  /** Point hebdomadaire par e-mail : ce qui demande une décision. */
  weeklyDigest: boolean
  /** false si le serveur n'a pas de serveur SMTP configuré. */
  emailConfigured: boolean
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

export type Urgence = 'urgent' | 'attention' | 'information'

/** Un point du briefing : ce qui demande une décision, et où la prendre. */
export interface PointBriefing {
  kind:
    | 'echeances_depassees'
    | 'echeances_proches'
    | 'echeances_proposees'
    | 'hausses'
    | 'quota'
  urgence: Urgence
  message: string
  actionLabel: string
  actionTo: string
}

export interface Briefing {
  points: PointBriefing[]
}

export type Cadence = 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle'

export interface RecurrenceOccurrence {
  documentId: string
  name: string
  date: string
  amount: number
}

/** Dépense qui revient chez un même émetteur, reconstituée à partir des documents. */
export interface RecurringSeries {
  provider: string
  /** null quand les intervalles sont trop irréguliers pour conclure. */
  cadence: Cadence | null
  occurrences: RecurrenceOccurrence[]
  lastAmount: number
  previousAmount: number
  variation: number
  variationPercent: number
  /** Ce que la dépense représente sur douze mois. */
  yearlyTotal: number
  /** Prochaine échéance attendue, si la cadence est reconnue. */
  nextExpected: string | null
}

export interface Recurrences {
  series: RecurringSeries[]
  /** Séries dont le dernier montant a sensiblement augmenté. */
  hausses: RecurringSeries[]
  yearlyTotal: number
  /** Documents lus dont l'émetteur n'a pas été reconnu. */
  unrecognized: number
  /** true si le plan donne droit à la lecture par IA. */
  aiReading: boolean
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
  /** Échéance de l'abonnement, null sur le plan gratuit. */
  renewsAt: string | null
  /** true si l'abonnement se termine à cette date au lieu d'être reconduit. */
  endsAtPeriodEnd: boolean
}

export interface PlanCatalogueEntry {
  plan: Plan
  label: string
  monthlyPrice: number
  maxDocuments: number | null
  features: PlanFeature[]
  purchasable: boolean
}
