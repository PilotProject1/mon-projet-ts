import type {
  Document,
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
  PlanUsage,
  PlanCatalogueEntry,
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
  async login(email: string, password: string) {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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

export const documentsApi = {
  list: () => request<Document[]>('/documents'),

  create: (data: { name: string; type?: DocumentType; file: File }) => {
    const formData = new FormData()
    formData.append('name', data.name)
    // Sans type, le serveur le déduit du contenu du document.
    if (data.type) formData.append('type', data.type)
    formData.append('file', data.file)
    return request<Document>('/documents', { method: 'POST', body: formData })
  },

  remove: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  analyze: (id: string) =>
    request<DocumentAnalysis>(`/documents/${id}/analyze`, { method: 'POST' }),

  /** Transforme l'échéance repérée automatiquement en échéance suivie. */
  acceptSuggestion: (id: string) =>
    request<Deadline>(`/documents/${id}/echeance-suggeree`, { method: 'POST' }),

  dismissSuggestion: (id: string) =>
    request<Document>(`/documents/${id}/echeance-suggeree`, { method: 'DELETE' }),

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

  updatePreferences: (emailReminders: boolean) =>
    request<NotificationPreferences>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ emailReminders }),
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

export const planApi = {
  get: () => request<PlanUsage>('/plan'),

  catalogue: () => request<{ plans: PlanCatalogueEntry[] }>('/plan/catalogue'),
}

export const billingApi = {
  /** Ouvre une session de paiement Stripe et renvoie l'URL de redirection. */
  checkout: (plan: 'premium' | 'pro') =>
    request<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  /** Portail Stripe : moyen de paiement, factures, résiliation. */
  portal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
}
