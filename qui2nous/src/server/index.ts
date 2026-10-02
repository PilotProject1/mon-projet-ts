import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { Ack, ClientVersServeur, ServeurVersClient } from '../shared/protocol.ts';
import { ErreurJeu, Salon, genererCode } from './salon.ts';

const PORT = Number(process.env.PORT ?? 3001);
/** Un salon abandonné (plus personne de connecté) est supprimé après ce délai. */
const DELAI_ABANDON_MS = 30 * 60_000;

const app = express();
// Vérifié par Render avant de basculer le trafic sur une nouvelle version.
app.get('/sante', (_req, res) => res.json({ ok: true, salons: salons.size }));
const dist = fileURLToPath(new URL('../../dist', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!socket\.io).*/, (_req, res) => res.sendFile(`${dist}/index.html`));
}
const http = createServer(app);
const io = new Server<ClientVersServeur, ServeurVersClient>(http);

const salons = new Map<string, Salon>();
const abandons = new Map<string, NodeJS.Timeout>();

function diffuser(code: string) {
  const salon = salons.get(code);
  if (!salon) return;
  for (const s of io.sockets.sockets.values()) {
    const { code: c, joueurId } = s.data as Session;
    if (c === code && joueurId) s.emit('vue', salon.vuePour(joueurId));
  }
}

function nouveauSalon() {
  const code = genererCode((c) => salons.has(c));
  salons.set(code, new Salon(code, () => diffuser(code)));
  return salons.get(code)!;
}

function surveillerAbandon(salon: Salon) {
  clearTimeout(abandons.get(salon.code));
  abandons.delete(salon.code);
  if (salon.vide) {
    salon.fermer();
    salons.delete(salon.code);
  } else if (salon.toutLeMondeDeconnecte) {
    abandons.set(
      salon.code,
      setTimeout(() => {
        if (!salon.toutLeMondeDeconnecte) return;
        salon.fermer();
        salons.delete(salon.code);
      }, DELAI_ABANDON_MS),
    );
  }
}

interface Session {
  code?: string;
  joueurId?: string;
}

function erreur(e: unknown): { ok: false; erreur: string } {
  if (e instanceof ErreurJeu) return { ok: false, erreur: e.message };
  console.error(e);
  return { ok: false, erreur: 'Erreur inattendue, réessaie.' };
}

io.on('connection', (socket: Socket<ClientVersServeur, ServeurVersClient>) => {
  const session = socket.data as Session;

  function attacher(salon: Salon, joueurId: string) {
    // Un même joueur ouvert dans deux onglets : seul le dernier reste actif.
    for (const s of io.sockets.sockets.values()) {
      if (s.id !== socket.id && (s.data as Session).joueurId === joueurId) {
        (s.data as Session).joueurId = undefined;
        s.disconnect(true);
      }
    }
    session.code = salon.code;
    session.joueurId = joueurId;
    salon.connexion(joueurId, true);
    surveillerAbandon(salon);
    socket.emit('vue', salon.vuePour(joueurId));
  }

  function dansSalon<T extends object = object>(
    ack: ((r: Ack<T>) => void) | undefined,
    action: (salon: Salon, joueurId: string) => T | void,
  ) {
    const salon = session.code ? salons.get(session.code) : undefined;
    if (!salon || !session.joueurId) return ack?.({ ok: false, erreur: 'Tu n’es dans aucun salon.' });
    try {
      const r = action(salon, session.joueurId);
      ack?.({ ok: true, ...(r ?? {}) } as Ack<T>);
    } catch (e) {
      ack?.(erreur(e));
    }
  }

  socket.on('creer', (p, ack) => {
    let salon: Salon | undefined;
    try {
      salon = nouveauSalon();
      const j = salon.ajouter(p?.nom, p?.avatar);
      attacher(salon, j.id);
      ack({ ok: true, code: salon.code, jeton: j.jeton });
    } catch (e) {
      if (salon?.vide) salons.delete(salon.code);
      ack(erreur(e));
    }
  });

  socket.on('rejoindre', (p, ack) => {
    const code = String(p?.code ?? '').trim().toUpperCase();
    const salon = salons.get(code);
    if (!salon) return ack({ ok: false, erreur: 'Aucun salon avec ce code.' });
    try {
      const j = salon.ajouter(p?.nom, p?.avatar);
      attacher(salon, j.id);
      ack({ ok: true, code, jeton: j.jeton });
    } catch (e) {
      ack(erreur(e));
    }
  });

  socket.on('reprendre', (p, ack) => {
    const salon = salons.get(String(p?.code ?? '').toUpperCase());
    const j = salon?.parJeton(String(p?.jeton ?? ''));
    if (!salon || !j) return ack({ ok: false, erreur: 'Cette partie n’existe plus.' });
    attacher(salon, j.id);
    ack({ ok: true });
  });

  socket.on('ajouterRobot', (ack) => dansSalon(ack, (s, id) => void s.ajouterRobot(id)));
  socket.on('retirerRobot', (p, ack) => dansSalon(ack, (s, id) => s.retirerRobot(id, p?.id)));
  socket.on('lancer', (p, ack) => dansSalon(ack, (s, id) => s.lancer(id, Number(p?.manches), p?.questions)));
  socket.on('proposerQuestion', (p, ack) => dansSalon(ack, (s, id) => s.proposerQuestion(id, p?.texte, p?.mode)));
  socket.on('retirerQuestion', (p, ack) => dansSalon(ack, (s, id) => s.retirerQuestion(id, p?.id)));
  socket.on('finirRedaction', (ack) => dansSalon(ack, (s, id) => s.finirRedaction(id)));
  socket.on('repondre', (p, ack) => dansSalon(ack, (s, id) => s.repondre(id, p?.valeur)));
  socket.on('voter', (p, ack) => dansSalon(ack, (s, id) => s.voter(id, p?.attributions)));
  socket.on('suivant', (ack) => dansSalon(ack, (s, id) => s.suivant(id)));
  socket.on('rejouer', (ack) => dansSalon(ack, (s, id) => s.rejouer(id)));

  socket.on('quitter', () => {
    dansSalon(undefined, (s, id) => {
      session.code = session.joueurId = undefined;
      s.retirer(id);
      surveillerAbandon(s);
    });
  });

  socket.on('disconnect', () => {
    const salon = session.code ? salons.get(session.code) : undefined;
    if (salon && session.joueurId) {
      salon.connexion(session.joueurId, false);
      surveillerAbandon(salon);
    }
  });
});

http.listen(PORT, () => console.log(`Qui2Nous écoute sur http://localhost:${PORT}`));
