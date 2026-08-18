/*
 * Documents d'épreuve pour la comparaison de modèles.
 *
 * Ils sont écrits à la main, et non repris de vrais documents d'utilisateurs :
 * un banc d'essai qui traîne dans un dépôt ne doit contenir les papiers de
 * personne. Ils reproduisent en revanche les formes qui ont réellement mis
 * l'extraction en défaut — mois écrits en toutes lettres, espaces insécables
 * dans les montants, mot « Commande » qui contient « MMA », attestation sans
 * échéance.
 *
 * `attendu` est ce qu'un lecteur humain répondrait. C'est lui qui transforme
 * la comparaison en note, plutôt qu'en simple constat de désaccord.
 */

export interface Attendu {
  suggestedType: string | null;
  suggestedProvider: string | null;
  suggestedAmount: number | null;
  suggestedDueDate: string | null;
  suggestedReference: string | null;
  suggestedPaid: boolean | null;
}

export interface DocumentEpreuve {
  nom: string;
  /** Ce que l'extraction de texte rendrait, mise en page comprise. */
  texte: string;
  attendu: Attendu;
  /** Pourquoi ce cas figure ici. */
  piege: string;
}

export const DOCUMENTS: DocumentEpreuve[] = [
  {
    nom: 'Facture EDF',
    piege: 'Cas nominal. Sert de repère : un modèle qui le rate rate tout.',
    texte: `EDF
Service Client Particuliers
TSA 21941 - 62978 ARRAS CEDEX 9

Facture d'électricité
Référence client : 8 234 567 891
Numéro de facture : FA2026081234

Période du 01/07/2026 au 31/07/2026
Consommation : 412 kWh

Montant HT                        70,25 €
TVA (20 %)                        14,05 €
Total TTC                         84,30 €

Net à payer : 84,30 €
Date limite de paiement : 05/09/2026

Prélèvement automatique non activé.`,
    attendu: {
      suggestedType: 'facture',
      suggestedProvider: 'EDF',
      suggestedAmount: 84.3,
      suggestedDueDate: '2026-09-05',
      suggestedReference: 'FA2026081234',
      suggestedPaid: false,
    },
  },
  {
    nom: 'Facture OVHcloud',
    piege:
      'Le cas qui a mis le moteur en défaut : « Commande » contient « MMA », le mois est écrit en toutes lettres, et le montant porte une espace insécable.',
    texte: `OVHcloud
2 rue Kellermann - 59100 Roubaix - France

Facture n° FR12345678
Commande n° 98765432

Date de facturation : 12 août 2026
Échéance de paiement : 26 août 2026

Désignation                              Montant
Nom de domaine .fr (1 an)                 7,99 €
Hébergement Web Perso (12 mois)          35,88 €
VPS Value (1 mois)                       11,99 €

Total HT                                 55,86 €
TVA 20 %                                 11,17 €
Total TTC                                67,03 €

Reste à payer : 67,03 €`,
    attendu: {
      suggestedType: 'facture',
      suggestedProvider: 'OVHcloud',
      suggestedAmount: 67.03,
      suggestedDueDate: '2026-08-26',
      suggestedReference: 'FR12345678',
      suggestedPaid: false,
    },
  },
  {
    nom: 'Attestation MAIF',
    piege:
      'Aucune action attendue : les dates sont une période de validité, pas une échéance. Un modèle trop zélé invente un rappel.',
    texte: `MAIF
Société d'assurance mutuelle
200 avenue Salvador Allende - 79038 NIORT CEDEX 9

ATTESTATION D'ASSURANCE HABITATION

Numéro de sociétaire : 1234567 A
Contrat n° H-2026-445566

Nous attestons que le contrat garantit le logement situé au
14 rue des Lilas, 57240 NILVANGE

Période de validité : du 01/01/2026 au 31/12/2026

Cette attestation est délivrée pour servir et valoir ce que de droit.
Fait à Niort, le 03/01/2026`,
    attendu: {
      suggestedType: 'assurance',
      suggestedProvider: 'MAIF',
      suggestedAmount: null,
      suggestedDueDate: null,
      suggestedReference: 'H-2026-445566',
      suggestedPaid: null,
    },
  },
  {
    nom: 'Facture Orange acquittée',
    piege:
      'Déjà payée : aucune échéance ne doit être proposée. Le mot « acquittée » et le prélèvement effectué doivent primer sur la date affichée.',
    texte: `Orange
Facture mobile

Compte client : 0612345678
N° de facture : 202608-ORA-778899

Date d'émission : 03/08/2026
Montant : 24,99 €

FACTURE ACQUITTÉE
Prélevée le 08/08/2026 sur le compte se terminant par 4421.

Aucune action de votre part n'est nécessaire.`,
    attendu: {
      suggestedType: 'facture',
      suggestedProvider: 'Orange',
      suggestedAmount: 24.99,
      suggestedDueDate: null,
      suggestedReference: '202608-ORA-778899',
      suggestedPaid: true,
    },
  },
  {
    nom: 'Contrat Free',
    piege:
      "Un contrat, pas une facture. La date d'engagement n'est pas une échéance de paiement.",
    texte: `Free
CONTRAT D'ABONNEMENT FREEBOX

Identifiant abonné : 55667788
Souscrit le 15 février 2026

Offre : Freebox Pop - 29,99 € par mois
Engagement : 12 mois à compter de la date de souscription
Fin de la période d'engagement : 15 février 2027

Résiliation possible à tout moment après la période d'engagement,
moyennant un préavis de 10 jours.`,
    attendu: {
      suggestedType: 'contrat',
      suggestedProvider: 'Free',
      suggestedAmount: 29.99,
      suggestedDueDate: null,
      suggestedReference: '55667788',
      suggestedPaid: null,
    },
  },
];
