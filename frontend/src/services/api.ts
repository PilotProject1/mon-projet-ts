import type { Document, DocumentType, Deadline, DeadlinePriority, DeadlineStatus, User } from '../types'

const API_URL = 'http://localhost:3000'

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
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

  create: (data: { name: string; type: DocumentType; fileUrl: string }) =>
    request<Document>('/documents', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
}

export const deadlinesApi = {
  list: () => request<Deadline[]>('/deadlines'),

  create: (data: {
    title: string
    dueDate: string
    priority: DeadlinePriority
    documentId?: string
  }) => request<Deadline>('/deadlines', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id: string, status: DeadlineStatus) =>
    request<Deadline>(`/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  remove: (id: string) => request<void>(`/deadlines/${id}`, { method: 'DELETE' }),
}
