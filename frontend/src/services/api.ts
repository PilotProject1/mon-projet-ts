import type {
  Document,
  DocumentCategory,
  DocumentType,
  Deadline,
  DeadlineStatus,
  User,
  Contract,
  RenewalType,
  Notification,
  NotificationPreferences,
  DocumentAnalysis,
  ShareLink,
  PublicShareInfo,
  Company,
  Client,
  Invoice,
  InvoiceStatus,
  SearchAnswer,
  Recurrences,
  Briefing,
  PlanUsage,
  PlanCatalogueEntry,
  BillingInterval,
  StatistiquesAdmin,
  EtatDeuxiemeFacteur,
  PreparationDeuxiemeFacteur,
  AdresseDepot,
  LettreIA,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const ACCESS_TOKEN_KEY = 'pilot_access_token'
const REFRESH_TOKEN_KEY = 'pilot_refresh_token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

/**
 * Sur un compte protégé par la double authentification, le mot de passe ne
 * rend aucun jeton : seulement le droit de présenter un code, pour quelques
 * minutes.
 */
interface DefiResponse {
  deuxiemeFacteurRequis: true
  challengeToken: string
}

export type ResultatConnexion =
  | { user: User }
  | { deuxiemeFacteurRequis: true; challengeToken: string }

async function rawRequest(path: string, options: RequestInit = {}) {
  const token = getAccessToken()
  const isFormData = options.body instanceof FormData
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  return res
}

async function parseError(res: Response) {
  try {
    const body = await res.json()
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message
    return message || `Erreur ${res.status}`
  } catch {
    return `Erreur ${res.status}`
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await rawRequest(path, options)

  if (res.status === 401 && retry && getRefreshToken()) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request<T>(path, options, false)
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res))
  }

  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    clearTokens()
    return false
  }
  const data: AuthResponse = await res.json()
  setTokens(data.accessToken, data.refreshToken)
  return true
}

export const authApi = {
  async login(email: string, password: string): Promise<ResultatConnexion> {
    const data = await request<AuthResponse | DefiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if ('deuxiemeFacteurRequis' in data) {
      return { deuxiemeFacteurRequis: true, challengeToken: data.challengeToken }
    }
    setTokens(data.accessToken, data.refreshToken)
    return { user: data.user }
  },

  /** Second temps de la connexion : le code, ou l'un des codes de secours. */
  async loginDeuxiemeFacteur(challengeToken: string, code: string) {
    const data = await request<AuthResponse>('/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    })
    setTokens(data.accessToken, data.refreshToken)
    return data.user
  },

  async register(email: string, password: string, name: string) {
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    setTokens(data.accessToken, data.refreshToken)
    return data.user
  },

  me: () => request<User>('/auth/me'),

  logout() {
    clearTokens()
  },
}

export const deuxFacteursApi = {
  etat: () => request<EtatDeuxiemeFacteur>('/auth/2fa'),

  preparer: () =>
    request<PreparationDeuxiemeFacteur>('/auth/2fa/preparer', { method: 'POST' }),

  activer: (code: string) =>
    request<{ codesDeSecours: string[] }>('/auth/2fa/activer', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  retirer: (password: string, code: string) =>
    request<void>('/auth/2fa/retirer', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),

  renouvelerLesCodes: (password: string, code: string) =>
    request<{ codesDeSecours: string[] }>('/auth/2fa/codes', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),
}

export const documentsApi = {
  list: () => request<Document[]>('/documents'),

  create: (data: {
    name: string
    type?: DocumentType
    category?: DocumentCategory
    file: File
  }) => {
    const formData = new FormData()
    formData.append('name', data.name)
    // Sans type, le serveur le déduit du contenu du document.
    if (data.type) formData.append('type', data.type)
    // Sans catégorie non plus : la lecture du document s'en charge.
    if (data.category) formData.append('category', data.category)
    formData.append('file', data.file)
    return request<Document>('/documents', { method: 'POST', body: formData })
  },

  /** Range le document, ou le sort de sa case si la catégorie est nulle. */
  setCategory: (id: string, category: DocumentCategory | null) =>
    request<Document>(`/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    }),

  remove: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  analyze: (id: string) =>
    request<DocumentAnalysis>(`/documents/${id}/analyze`, { method: 'POST' }),

  /** Transforme l'échéance repérée automatiquement en échéance suivie. */
  acceptSuggestion: (id: string) =>
    request<Deadline>(`/documents/${id}/echeance-suggeree`, { method: 'POST' }),

  dismissSuggestion: (id: string) =>
    request<Document>(`/documents/${id}/echeance-suggeree`, { method: 'DELETE' }),

  /** Brouillon de courrier rédigé par l'IA — jamais envoyé seul. */
  draftLetter: (id: string, kind: 'resiliation' | 'contestation') =>
    request<LettreIA>(`/documents/${id}/letter`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),

  async getFileBlob(id: string, retry = true): Promise<Blob> {
    const res = await rawRequest(`/documents/${id}/file`)
    if (res.status === 401 && retry && (await tryRefresh())) {
      return documentsApi.getFileBlob(id, false)
    }
    if (!res.ok) {
      throw new ApiError(res.status, await parseError(res))
    }
    return res.blob()
  },
}

export const deadlinesApi = {
  list: () => request<Deadline[]>('/deadlines'),

  create: (data: { title: string; dueDate: string; documentId?: string }) =>
    request<Deadline>('/deadlines', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id: string, status: DeadlineStatus) =>
    request<Deadline>(`/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  remove: (id: string) => request<void>(`/deadlines/${id}`, { method: 'DELETE' }),

  // null lorsqu'un rappel identique a déjà été envoyé pour ce palier.
  remind: (id: string) =>
    request<Notification | null>(`/deadlines/${id}/remind`, { method: 'POST' }),
}

export const contractsApi = {
  list: () => request<Contract[]>('/contracts'),

  create: (data: {
    provider: string
    startDate: string
    endDate: string
    amount: number
    renewalType: RenewalType
    documentId: string
  }) => request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => request<void>(`/contracts/${id}`, { method: 'DELETE' }),
}

export const notificationsApi = {
  list: () => request<Notification[]>('/notifications'),

  markRead: (id: string) =>
    request<Notification>(`/notifications/${id}/lue`, { method: 'PATCH' }),

  getPreferences: () => request<NotificationPreferences>('/notifications/preferences'),

  updatePreferences: (emailReminders: boolean, weeklyDigest?: boolean) =>
    request<NotificationPreferences>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ emailReminders, weeklyDigest }),
    }),
}

export const pushApi = {
  getPublicKey: () =>
    request<{ publicKey: string | null; available: boolean; devices: number }>(
      '/push/cle-publique',
    ),

  subscribe: (subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
    label?: string
  }) =>
    request<{ subscribed: boolean }>('/push/abonnements', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),

  unsubscribe: (endpoint: string) =>
    request<{ subscribed: boolean }>('/push/abonnements', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),
}

export const sharesApi = {
  list: () => request<ShareLink[]>('/shares'),

  create: (data: { documentId: string; expiresInHours: 24 | 168 | 720 }) =>
    request<ShareLink>('/shares', { method: 'POST', body: JSON.stringify(data) }),

  revoke: (id: string) => request<void>(`/shares/${id}`, { method: 'DELETE' }),
}

// Le partage public n'est jamais authentifié : pas de token, pas de retry sur 401.
export const publicSharesApi = {
  async getInfo(token: string): Promise<PublicShareInfo> {
    const res = await fetch(`${API_URL}/public/shares/${token}`)
    if (!res.ok) {
      throw new ApiError(res.status, await parseError(res))
    }
    return res.json()
  },

  async getFileBlob(token: string): Promise<Blob> {
    const res = await fetch(`${API_URL}/public/shares/${token}/file`)
    if (!res.ok) {
      throw new ApiError(res.status, await parseError(res))
    }
    return res.blob()
  },
}

export const companyApi = {
  get: () => request<Company>('/company'),

  create: (data: { name: string; legalInfo?: string }) =>
    request<Company>('/company', { method: 'POST', body: JSON.stringify(data) }),

  update: (data: { name?: string; legalInfo?: string }) =>
    request<Company>('/company', { method: 'PATCH', body: JSON.stringify(data) }),
}

export const clientsApi = {
  list: () => request<Client[]>('/clients'),

  create: (data: { name: string; email: string; phone?: string }) =>
    request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
}

export const invoicesApi = {
  list: () => request<Invoice[]>('/invoices'),

  create: (data: { clientId: string; total: number; dueDate: string }) =>
    request<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id: string, status: InvoiceStatus) =>
    request<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  remove: (id: string) => request<void>(`/invoices/${id}`, { method: 'DELETE' }),
}

export const searchApi = {
  ask: (query: string) =>
    request<SearchAnswer>('/search', { method: 'POST', body: JSON.stringify({ query }) }),
}

export const briefingApi = {
  get: () => request<Briefing>('/briefing'),
}

export const recurrencesApi = {
  get: () => request<Recurrences>('/recurrences'),
}

export const depotEmailApi = {
  adresse: () => request<AdresseDepot>('/depot-email/adresse'),

  regenerer: () =>
    request<{ adresse: string }>('/depot-email/regenerer', { method: 'POST' }),
}

export const usersApi = {
  /**
   * Copie de toutes ses données, telle que le serveur la renvoie.
   *
   * On passe par le flux brut plutôt que par `request` : c'est un fichier à
   * enregistrer, pas un objet à interpréter, et l'analyser pour le
   * re-sérialiser ensuite ne ferait que le déformer.
   */
  async exporterMesDonnees(retry = true): Promise<Blob> {
    const res = await rawRequest('/users/moi/export')
    if (res.status === 401 && retry && (await tryRefresh())) {
      return usersApi.exporterMesDonnees(false)
    }
    if (!res.ok) throw new ApiError(res.status, await parseError(res))
    return res.blob()
  },

  /** Suppression définitive de son propre compte. Aucun retour en arrière. */
  supprimerMonCompte: (password: string) =>
    request<void>('/users/moi', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
}

export const adminApi = {
  statistiques: () => request<StatistiquesAdmin>('/admin/statistiques'),
}

export const planApi = {
  get: () => request<PlanUsage>('/plan'),

  catalogue: () => request<{ plans: PlanCatalogueEntry[] }>('/plan/catalogue'),
}

export const billingApi = {
  /** Ouvre une session de paiement Stripe et renvoie l'URL de redirection. */
  checkout: (plan: 'premium' | 'pro', interval: BillingInterval = 'mensuel') =>
    request<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, interval }),
    }),

  /** Portail Stripe : moyen de paiement, factures, résiliation. */
  portal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
}
