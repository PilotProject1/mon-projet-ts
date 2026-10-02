import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientVersServeur, ServeurVersClient, Vue } from '../shared/protocol.ts';

export type SocketJeu = Socket<ServeurVersClient, ClientVersServeur>;

export const socket: SocketJeu = io({ autoConnect: true });

// Le téléphone garde de quoi revenir dans la partie : écran éteint, onglet
// rechargé, réseau perdu quelques secondes…
const CLE = 'qui2nous:session';

export function memoriserSession(code: string, jeton: string) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ code, jeton }));
  } catch {
    /* navigation privée : on joue sans reprise automatique */
  }
}

export function oublierSession() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
}

function sessionMemorisee(): { code: string; jeton: string } | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    return s && typeof s.code === 'string' && typeof s.jeton === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** Envoie une action au serveur et attend sa réponse. */
export function envoyer<T extends object = object>(
  emettre: (ack: (r: Ack<T>) => void) => void,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve({ ok: false, erreur: 'Connexion perdue, on réessaie…' });
    emettre(resolve);
  });
}

export function useJeu() {
  const [vue, setVueBrute] = useState<Vue | null>(null);
  const [decalage, setDecalage] = useState(0);
  const [connecte, setConnecte] = useState(socket.connected);
  const [reprise, setReprise] = useState(() => sessionMemorisee() !== null);

  useEffect(() => {
    const surConnexion = () => {
      setConnecte(true);
      const s = sessionMemorisee();
      if (!s) return setReprise(false);
      socket.emit('reprendre', s, (r) => {
        if (!r.ok) {
          oublierSession();
          setVueBrute(null);
        }
        setReprise(false);
      });
    };
    const surDeconnexion = () => setConnecte(false);
    const setVue = (v: Vue | null) => {
      if (v) setDecalage(v.maintenant - Date.now());
      setVueBrute(v);
    };
    socket.on('connect', surConnexion);
    socket.on('disconnect', surDeconnexion);
    socket.on('vue', setVue);
    if (socket.connected) surConnexion();
    return () => {
      socket.off('connect', surConnexion);
      socket.off('disconnect', surDeconnexion);
      socket.off('vue', setVue);
    };
  }, []);

  const quitter = () => {
    socket.emit('quitter');
    oublierSession();
    setVueBrute(null);
  };

  return { vue, decalage, connecte, reprise, quitter };
}

/** Secondes restantes avant l'échéance, corrigées du décalage d'horloge. */
export function useCompteARebours(echeance: number | null, decalage: number) {
  const [, rafraichir] = useState(0);
  useEffect(() => {
    if (echeance === null) return;
    const t = setInterval(() => rafraichir((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [echeance]);
  if (echeance === null) return null;
  return Math.max(0, Math.ceil((echeance - (Date.now() + decalage)) / 1000));
}
