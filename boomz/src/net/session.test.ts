import { describe, expect, it } from 'vitest';
import type { ServerMessage } from './protocol';
import { Room } from './room';
import { cleanName, Session, type RoomDirectory } from './session';

function setup() {
  const rooms = new Map<string, Room>();
  const directory: RoomDirectory = {
    create() {
      const room = new Room(`R${rooms.size}`, () => 1);
      rooms.set(room.code, room);
      return room;
    },
    find: (code) => rooms.get(code),
  };
  let next = 0;
  const open = () => {
    const inbox: ServerMessage[] = [];
    const session = new Session(directory, (message) => inbox.push(message), () => `id${next++}`);
    return { session, inbox };
  };
  return { rooms, open };
}

describe('Session', () => {
  it('crée un salon, le fait rejoindre et lance la partie', () => {
    const { open } = setup();
    const alice = open();
    alice.session.handle({ type: 'create', name: '  Alice  ' });
    const welcome = alice.inbox.find((message) => message.type === 'welcome');
    expect(welcome).toMatchObject({ type: 'welcome', room: 'R0' });

    const bob = open();
    bob.session.handle({ type: 'join', room: 'r0', name: 'Bob' });
    bob.session.handle({ type: 'ready', ready: true });
    alice.session.handle({ type: 'start' });
    const lobby = alice.inbox.filter((message) => message.type === 'lobby').pop();
    expect(lobby).toMatchObject({ inMatch: true });
    expect(lobby?.type === 'lobby' && lobby.players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
  });

  it('refuse un salon inconnu et ignore les commandes hors salon', () => {
    const { open } = setup();
    const lost = open();
    lost.session.handle({ type: 'join', room: 'NOPE', name: 'X' });
    lost.session.handle({ type: 'bomb' });
    expect(lost.inbox).toEqual([{ type: 'error', message: expect.stringContaining('introuvable') }]);
  });

  it('reprend sa place avec son jeton après une coupure', () => {
    const { open, rooms } = setup();
    const alice = open();
    alice.session.handle({ type: 'create', name: 'Alice' });
    const welcome = alice.inbox[0] as Extract<ServerMessage, { type: 'welcome' }>;
    alice.session.closed();

    const back = open();
    back.session.handle({ type: 'resume', room: welcome.room, token: welcome.token });
    expect(back.inbox[0]).toMatchObject({ type: 'welcome', you: welcome.you });
    expect(rooms.get(welcome.room)?.isEmpty).toBe(false);
  });

  it('répond aux mesures de latence', () => {
    const { open } = setup();
    const phone = open();
    phone.session.handle({ type: 'ping', sent: 42 });
    expect(phone.inbox).toEqual([{ type: 'pong', sent: 42 }]);
  });
});

describe('cleanName', () => {
  it('nettoie et limite le pseudo', () => {
    expect(cleanName('  Léa   la   reine  ')).toBe('Léa la reine');
    expect(cleanName('')).toBe('Joueur');
    expect(cleanName(12)).toBe('Joueur');
    expect(cleanName('x'.repeat(40))).toHaveLength(16);
  });
});
