import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_SECONDS } from '../src/game/constants';
import { ARENA_IDS } from '../src/game/types';
import { WS_PATH, type ClientMessage, type ServerMessage } from '../src/net/protocol';
import { createPeer, Room, type Peer } from './room';
import { GameStats } from './stats';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = resolve(import.meta.dirname, '../dist');
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const MAX_MESSAGE_BYTES = 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const rooms = new Map<string, Room>();
const stats = new GameStats();

function newRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
  return name || 'Joueur';
}

// ---- Fichiers du jeu (la version compilée par `vite build`) ----

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  if (path === '/stats') {
    // Statistiques anonymes pour l'équilibrage (voir server/stats.ts).
    response
      .writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      .end(JSON.stringify({ salonsOuverts: rooms.size, ...stats.summary() }, null, 2));
    return;
  }
  const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
  if (!file.startsWith(DIST)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    // Les liens d'invitation (/?salon=…) comme les chemins inconnus renvoient au jeu.
    try {
      response.writeHead(200, { 'content-type': CONTENT_TYPES['.html'] }).end(await readFile(join(DIST, 'index.html')));
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Jeu non compilé : lancer `npm run build`.');
    }
  }
});

// ---- Connexions des téléphones ----

const wss = new WebSocketServer({
  server,
  path: WS_PATH,
  maxPayload: MAX_MESSAGE_BYTES,
  // L'état de la partie (≈ 4 Ko, 20 fois par seconde) se compresse très bien :
  // environ 7 fois moins de données mobiles consommées par joueur.
  perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 } },
});
const alive = new WeakSet<WebSocket>();

wss.on('connection', (socket) => {
  alive.add(socket);
  socket.on('pong', () => alive.add(socket));

  const send = (message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  let peer: Peer | null = null;
  let room: Room | null = null;

  socket.on('message', (data) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    switch (message.type) {
      case 'create':
      case 'join': {
        if (room) return;
        const target =
          message.type === 'create' ? new Room(newRoomCode(), undefined, stats) : rooms.get(String(message.room).trim().toUpperCase());
        if (!target) {
          send({ type: 'error', message: 'Salon introuvable : vérifiez le code ou demandez un nouveau lien.' });
          return;
        }
        const candidate = createPeer(randomUUID(), randomUUID(), cleanName(message.name), send);
        const error = target.join(candidate);
        if (error) {
          send({ type: 'error', message: error });
          return;
        }
        rooms.set(target.code, target);
        room = target;
        peer = candidate;
        return;
      }
      case 'resume': {
        if (room) return;
        const target = rooms.get(String(message.room).toUpperCase());
        const resumed = target?.resume(String(message.token), send) ?? null;
        if (!target || !resumed) {
          send({ type: 'error', code: 'resume-failed', message: 'La place dans ce salon a expiré.' });
          return;
        }
        room = target;
        peer = resumed;
        return;
      }
      case 'ping':
        // Mesure de latence, pour les avis des testeurs.
        if (typeof message.sent === 'number') send({ type: 'pong', sent: message.sent });
        return;
      case 'leave':
        if (room && peer) room.leave(peer.id);
        room = null;
        peer = null;
        return;
    }
    if (!room || !peer) return;
    switch (message.type) {
      case 'ready':
        room.setReady(peer.id, message.ready === true);
        return;
      case 'skin':
        room.setSkin(peer.id, Number(message.skin));
        return;
      case 'arena':
        if (message.arena === 'rotation' || (ARENA_IDS as readonly string[]).includes(message.arena)) {
          room.setArena(peer.id, message.arena);
        }
        return;
      case 'start': {
        const error = room.start(peer.id);
        if (error) send({ type: 'error', message: error });
        return;
      }
      case 'input':
        if (message.direction === null || ['up', 'down', 'left', 'right'].includes(message.direction)) {
          room.setDirection(peer.id, message.direction);
        }
        return;
      case 'bomb':
        room.requestBomb(peer.id);
        return;
      case 'detonate':
        room.requestDetonation(peer.id);
        return;
    }
  });

  socket.on('close', () => {
    // Le joueur garde sa place quelques secondes : un téléphone qui change de
    // réseau ou recharge la page peut la reprendre.
    // Si la place a déjà été reprise par une nouvelle connexion, rien à faire.
    if (room && peer && peer.send === send) room.disconnect(peer.id);
  });
});

// Détecte les téléphones partis sans fermer la connexion (réseau coupé, veille).
setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) {
      socket.terminate();
      continue;
    }
    alive.delete(socket);
    socket.ping();
  }
}, 5000);

// ---- Boucle de simulation à pas fixe ----

const tickMs = TICK_SECONDS * 1000;
let last = performance.now();
let accumulator = 0;
setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(now - last, 250);
  last = now;
  while (accumulator >= tickMs) {
    for (const [code, room] of rooms) {
      room.tick();
      if (room.isEmpty) rooms.delete(code);
    }
    accumulator -= tickMs;
  }
}, 4);

server.listen(PORT, () => {
  console.log(`Serveur Boomz : http://localhost:${PORT}`);
});
