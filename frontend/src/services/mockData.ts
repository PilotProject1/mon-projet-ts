import type { Document, Deadline } from '../types'

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    userId: 'user-1',
    name: 'Contrat assurance habitation',
    type: 'assurance',
    fileUrl: '#',
    status: 'traite',
    createdAt: '2026-06-02',
  },
  {
    id: 'doc-2',
    userId: 'user-1',
    name: 'Facture EDF juillet',
    type: 'facture',
    fileUrl: '#',
    status: 'traite',
    createdAt: '2026-07-10',
  },
  {
    id: 'doc-3',
    userId: 'user-1',
    name: 'Contrat de bail appartement',
    type: 'contrat',
    fileUrl: '#',
    status: 'en_attente',
    createdAt: '2026-08-01',
  },
]

export const mockDeadlines: Deadline[] = [
  {
    id: 'dl-1',
    userId: 'user-1',
    documentId: 'doc-1',
    title: "Renouvellement assurance habitation",
    dueDate: '2026-09-15',
    priority: 'haute',
    status: 'a_faire',
  },
  {
    id: 'dl-2',
    userId: 'user-1',
    documentId: 'doc-2',
    title: 'Paiement facture EDF',
    dueDate: '2026-08-20',
    priority: 'moyenne',
    status: 'a_faire',
  },
  {
    id: 'dl-3',
    userId: 'user-1',
    documentId: 'doc-3',
    title: 'Signature contrat de bail',
    dueDate: '2026-08-14',
    priority: 'haute',
    status: 'a_faire',
  },
  {
    id: 'dl-4',
    userId: 'user-1',
    documentId: null,
    title: 'Déclaration impôts fonciers',
    dueDate: '2026-10-01',
    priority: 'basse',
    status: 'terminee',
  },
]
