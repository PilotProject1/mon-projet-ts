import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_SECONDS } from '../src/game/constants';
import { WS_PATH, type ClientMessage, type IceServer, type ServerMessage } from '../src/net/protocol';
import { Room } from '../src/net/room';
import { newRoomCode, Session, type RoomDirectory } from '../src/net/session';
import { GameStats } from './stats';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = resolve(import.meta.dirname, '../dist');
// Assez pour une description de session WebRTC (chat vocal).
const MAX_MESSAGE_BYTES = 16 * 1024;
/** Identifiant de l'application installée (voir capacitor.config.ts). */
const APP_ID = 'fr.boomz.jeu';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const rooms = new Map<string, Room>();
const stats = new GameStats();

/**
 * Serveurs qui aident les téléphones à se joindre pour le chat vocal : STUN
 * public, plus un relais TURN si l'hébergeur en fournit un (certains réseaux
 * mobiles empêchent la liaison directe).
 */
const iceServers: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
if (process.env.TURN_URLS) {
  iceServers.push({
    urls: process.env.TURN_URLS.split(',').map((url) => url.trim()),
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_CREDENTIAL,
  });
}

const directory: RoomDirectory = {
  create() {
    const room = new Room(newRoomCode((code) => rooms.has(code)), undefined, stats, iceServers);
    rooms.set(room.code, room);
    return room;
  },
  find: (code) => rooms.get(code),
};

// ---- Site : page d'accueil et confidentialité ----

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  // Liens d'invitation ouverts dans l'application installée : Android et iOS
  // vérifient que ce site autorise l'application (empreinte du certificat de
  // signature Android, identifiant d'équipe Apple). Tant que les variables ne
  // sont pas renseignées chez l'hébergeur, les liens s'ouvrent dans le navigateur.
  if (path === '/.well-known/assetlinks.json' && process.env.ANDROID_CERT_SHA256) {
    const fingerprints = process.env.ANDROID_CERT_SHA256.split(',').map((value) => value.trim());
    response.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
        },
      ]),
    );
    return;
  }
  if (path === '/.well-known/apple-app-site-association' && process.env.APPLE_TEAM_ID) {
    response.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        applinks: { details: [{ appIDs: [`${process.env.APPLE_TEAM_ID}.${APP_ID}`], components: [{ '?': { salon: '?*' } }] }] },
      }),
    );
    return;
  }
  if (path === '/stats') {
    // Statistiques anonymes pour l'équilibrage (voir server/stats.ts).
    response
      .writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      .end(JSON.stringify({ salonsOuverts: rooms.size, ...stats.summary() }, null, 2));
    return;
  }
  // Le jeu se joue dans l'application : le site ne montre plus que la page
  // d'accueil (qui renvoie vers l'application et affiche le code des liens
  // d'invitation) et les pages de confidentialité et d'assistance exigées par l'App Store.
  if (path === '/confidentialite') {
    await sendFile(response, 'confidentialite.html');
    return;
  }
  if (path === '/assistance') {
    await sendFile(response, 'assistance.html');
    return;
  }
  if (path === '/sw.js' || path === '/favicon.png' || /^\/icons\/[\w-]+\.png$/.test(path)) {
    await sendFile(response, path.slice(1));
    return;
  }
  const page = await readFile(join(DIST, 'invitation.html'), 'utf8').catch(() => null);
  if (page === null) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Site non compilé : lancer `npm run build`.');
    return;
  }
  response
    .writeHead(200, { 'content-type': CONTENT_TYPES['.html'], 'cache-control': 'no-cache' })
    .end(page.replace('__APP_URL__', appUrl()));
});

/** Adresse d'installation (TestFlight, puis App Store), réglée chez l'hébergeur. */
function appUrl(): string {
  const url = process.env.APP_STORE_URL?.trim() ?? '';
  return /^https:\/\/[^"<>\s]+$/.test(url) ? url : '';
}

async function sendFile(response: ServerResponse, name: string): Promise<void> {
  const file = normalize(join(DIST, name));
  if (!file.startsWith(DIST)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
}

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
  const session = new Session(directory, send, randomUUID);

  socket.on('message', (data) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    session.handle(message);
  });

  socket.on('close', () => session.closed());
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
