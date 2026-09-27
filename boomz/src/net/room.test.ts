import { describe, expect, it } from 'vitest';
import { COUNTDOWN_TICKS, TICK_RATE } from '../game/constants';
import type { MatchState } from '../game/match';
import { RECONNECT_GRACE_SECONDS, type ServerMessage } from './protocol';
import { createPeer, distinctSkins, Room, type Peer } from './room';

type FakePeer = Peer & { inbox: ServerMessage[] };

function fakePeer(id: string): FakePeer {
  const inbox: ServerMessage[] = [];
  return Object.assign(createPeer(id, `secret-${id}`, id, (message) => inbox.push(message)), { inbox });
}

function lastOf<T extends ServerMessage['type']>(peer: FakePeer, type: T): Extract<ServerMessage, { type: T }> {
  const found = peer.inbox.filter((message) => message.type === type).pop();
  if (!found) throw new Error(`aucun message ${type}`);
  return found as Extract<ServerMessage, { type: T }>;
}

const snapshot = (peer: FakePeer): MatchState => lastOf(peer, 'snapshot').match;

/** Salon à deux joueurs prêts, partie lancée par Alice. */
function startedRoom(): { room: Room; alice: FakePeer; bob: FakePeer } {
  const room = new Room('ABCDE', () => 1);
  const alice = fakePeer('alice');
  const bob = fakePeer('bob');
  room.join(alice);
  room.join(bob);
  room.setReady('bob', true);
  expect(room.start('alice')).toBeNull();
  return { room, alice, bob };
}

describe('salon', () => {
  it('ne se lance qu’à la demande de l’hôte, à deux et quand les autres sont prêts', () => {
    const room = new Room('ABCDE', () => 1);
    const alice = fakePeer('alice');
    const bob = fakePeer('bob');
    room.join(alice);
    expect(room.start('alice')).toMatch(/au moins/);
    room.join(bob);
    expect(room.start('alice')).toMatch(/prêts/);
    room.setReady('bob', true);
    expect(room.start('bob')).toMatch(/hôte/);
    expect(room.start('alice')).toBeNull();
    expect(snapshot(bob).phase).toBe('countdown');
    expect(room.join(fakePeer('carol'))).toMatch(/déjà commencé/);
  });

  it('accueille jusqu’à six joueurs et refuse le septième', () => {
    const room = new Room('ABCDE');
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(room.join(fakePeer(id))).toBeNull();
    expect(room.join(fakePeer('g'))).toMatch(/complet/);
  });

  it('laisse l’hôte seul choisir l’arène, utilisée au lancement', () => {
    const room = new Room('ABCDE', () => 1);
    const alice = fakePeer('alice');
    const bob = fakePeer('bob');
    room.join(alice);
    room.join(bob);
    expect(lastOf(bob, 'lobby').arena).toBe('rotation');
    room.setArena('bob', 'station');
    expect(lastOf(bob, 'lobby').arena).toBe('rotation');
    room.setArena('alice', 'temple');
    expect(lastOf(bob, 'lobby').arena).toBe('temple');
    room.setReady('bob', true);
    room.start('alice');
    expect(snapshot(bob).round.arena).toBe('temple');
  });

  it('transmet l’apparence choisie par chaque joueur, et refuse une apparence inconnue', () => {
    const room = new Room('ABCDE', () => 1);
    const alice = fakePeer('alice');
    const bob = fakePeer('bob');
    room.join(alice);
    room.join(bob);
    room.setSkin('bob', 2);
    room.setSkin('alice', 7);
    expect(lastOf(alice, 'lobby').players.map((player) => player.skin)).toEqual([0, 2]);
    room.setReady('bob', true);
    room.start('alice');
    expect(snapshot(alice).skins).toEqual([0, 2]);
  });

  it('ne dévoile pas aux téléphones les bonus cachés sous les caisses', () => {
    const { alice } = startedRoom();
    expect(snapshot(alice).round.hiddenBonuses).toEqual([]);
  });

  it('applique les commandes de chaque téléphone à son propre personnage', () => {
    const { room, alice } = startedRoom();
    for (let i = 0; i < COUNTDOWN_TICKS; i++) room.tick();
    room.requestBomb('bob');
    room.setDirection('alice', 'right');
    for (let i = 0; i < 12; i++) room.tick();
    const state = snapshot(alice);
    expect(state.round.players[0].x).toBeGreaterThan(1.9);
    expect(state.round.players[1].x).toBeCloseTo(11.5);
    expect(state.round.bombs.map((bomb) => bomb.owner)).toEqual([1]);
  });

  it('laisse un joueur coupé reprendre sa place pendant la période de grâce', () => {
    const { room, alice } = startedRoom();
    for (let i = 0; i < COUNTDOWN_TICKS + 1; i++) room.tick();
    room.disconnect('bob');
    for (let i = 0; i < TICK_RATE; i++) room.tick();
    expect(snapshot(alice).round.players[1].alive).toBe(true);

    const inbox: ServerMessage[] = [];
    expect(room.resume('mauvais-jeton', (message) => inbox.push(message))).toBeNull();
    const back = room.resume('secret-bob', (message) => inbox.push(message));
    expect(back?.id).toBe('bob');
    expect(inbox.map((message) => message.type)).toContain('snapshot');
    for (let i = 0; i < RECONNECT_GRACE_SECONDS * TICK_RATE; i++) room.tick();
    expect(snapshot(alice).round.players[1].alive).toBe(true);
  });

  it('élimine un joueur qui ne revient pas, et donne la manche à l’autre', () => {
    const { room, alice } = startedRoom();
    for (let i = 0; i < COUNTDOWN_TICKS + 1; i++) room.tick();
    room.disconnect('bob');
    for (let i = 0; i < RECONNECT_GRACE_SECONDS * TICK_RATE + 3; i++) room.tick();
    const state = snapshot(alice);
    expect(state.round.players[1].alive).toBe(false);
    expect(state.scores).toEqual([1, 0]);
  });

  it('libère tout de suite la place d’un joueur qui quitte, et transmet l’hôte', () => {
    const room = new Room('ABCDE');
    const alice = fakePeer('alice');
    const bob = fakePeer('bob');
    room.join(alice);
    room.join(bob);
    room.leave('alice');
    const lobby = lastOf(bob, 'lobby');
    expect(lobby.host).toBe('bob');
    expect(lobby.players.map((player) => player.id)).toEqual(['bob']);
    room.leave('bob');
    expect(room.isEmpty).toBe(true);
  });

  it('ne transmet pas le jeton secret aux autres joueurs', () => {
    const { alice } = startedRoom();
    expect(JSON.stringify(alice.inbox)).not.toContain('secret-bob');
  });

  describe('chat vocal', () => {
    const offer = { description: { type: 'offer' as const, sdp: 'v=0' } };

    it('annonce qui est dans le vocal et relaie la mise en relation entre eux seuls', () => {
      const room = new Room('ABCDE', () => 1, null, [{ urls: 'stun:exemple' }]);
      const alice = fakePeer('alice');
      const bob = fakePeer('bob');
      const carol = fakePeer('carol');
      room.join(alice);
      room.join(bob);
      room.join(carol);
      expect(lastOf(alice, 'welcome').iceServers).toEqual([{ urls: 'stun:exemple' }]);

      room.setVoice('alice', true);
      room.setVoice('bob', true);
      expect(lastOf(carol, 'lobby').players.map((player) => player.voice)).toEqual([true, true, false]);

      room.relaySignal('alice', 'bob', offer);
      expect(lastOf(bob, 'signal')).toEqual({ type: 'signal', from: 'alice', data: offer });
      // Carol n'est pas dans le vocal : rien ne lui parvient, et elle ne peut rien envoyer.
      room.relaySignal('alice', 'carol', offer);
      room.relaySignal('carol', 'bob', offer);
      expect(carol.inbox.some((message) => message.type === 'signal')).toBe(false);
      expect(bob.inbox.filter((message) => message.type === 'signal')).toHaveLength(1);
    });

    it('sort du vocal un joueur dont la connexion est perdue', () => {
      const room = new Room('ABCDE');
      const alice = fakePeer('alice');
      const bob = fakePeer('bob');
      room.join(alice);
      room.join(bob);
      room.setVoice('bob', true);
      room.disconnect('bob');
      expect(lastOf(alice, 'lobby').players[1].voice).toBe(false);
    });
  });

  it('relaie les émojis des joueurs de la partie, sans spam', () => {
    const { room, alice, bob } = startedRoom();
    room.sendEmote('bob', 2);
    room.sendEmote('bob', 3);
    room.sendEmote('alice', 99);
    expect(alice.inbox.filter((message) => message.type === 'emote')).toEqual([{ type: 'emote', seat: 1, emote: 2 }]);
    for (let i = 0; i < TICK_RATE; i++) room.tick();
    room.sendEmote('bob', 3);
    expect(lastOf(bob, 'emote')).toEqual({ type: 'emote', seat: 1, emote: 3 });
  });

  describe('personnages et pouvoirs', () => {
    it('donnent à chacun son personnage, et les pouvoirs si tous les téléphones les connaissent', () => {
      const room = new Room('ABCDE', () => 1);
      const alice = fakePeer('alice');
      const bob = fakePeer('bob');
      room.join(alice);
      room.join(bob);
      room.setCharacter('alice', 6);
      room.setCharacter('bob', 99);
      expect(lastOf(alice, 'lobby').players[0].character).toBe(6);
      expect(lastOf(alice, 'lobby').players[1].character).toBeUndefined();
      room.setReady('bob', true);
      room.start('alice');
      // Bob (ancienne version, sans choix de personnage) : pas de pouvoirs, personnage de sa place.
      expect(snapshot(alice).characters).toEqual([6, 1]);
      expect(snapshot(alice).powers).toBe(false);
    });

    it('activent les pouvoirs quand tout le monde a choisi, robots compris', () => {
      const room = new Room('ABCDE', () => 1);
      const alice = fakePeer('alice');
      room.join(alice);
      room.setCharacter('alice', 2);
      room.addBot('alice', 'pro');
      room.start('alice');
      expect(snapshot(alice).powers).toBe(true);
      expect(snapshot(alice).characters[1]).not.toBe(2);
    });

    it('relaient l’usage du pouvoir au joueur concerné', () => {
      const room = new Room('ABCDE', () => 1);
      const alice = fakePeer('alice');
      room.join(alice);
      room.setCharacter('alice', 7);
      room.addBot('alice', 'debutant');
      room.start('alice');
      for (let i = 0; i < COUNTDOWN_TICKS + 5 * TICK_RATE; i++) room.tick();
      room.requestPower('alice');
      room.tick();
      expect(snapshot(alice).round.players[0].effect).toBe(7);
    });

    it('séparent deux joueurs sur le même personnage par leur apparence', () => {
      expect(distinctSkins([3, 3, 1, 3], [0, 0, 0, 0])).toEqual([0, 1, 0, 2]);
      expect(distinctSkins([3, 3], [2, 1])).toEqual([2, 1]);
    });
  });

  describe('robots', () => {
    it('ne sont ajoutés que par l’hôte, et permettent de jouer seul', () => {
      const room = new Room('ABCDE', () => 3);
      const alice = fakePeer('alice');
      const bob = fakePeer('bob');
      room.join(alice);
      room.join(bob);
      expect(room.addBot('bob', 'pro')).not.toBeNull();
      room.leave('bob');
      expect(room.addBot('alice', 'expert')).toBeNull();
      const players = lastOf(alice, 'lobby').players;
      expect(players[1]).toMatchObject({ bot: 'expert', ready: true, connected: true });
      expect(room.start('alice')).toBeNull();
    });

    it('jouent réellement : ils se déplacent et posent des bombes', () => {
      const room = new Room('ABCDE', () => 11);
      const alice = fakePeer('alice');
      room.join(alice);
      room.addBot('alice', 'expert');
      room.addBot('alice', 'pro');
      room.start('alice');
      const spawns = snapshot(alice).round.players.map((player) => [player.x, player.y]);
      let bombs = 0;
      for (let i = 0; i < COUNTDOWN_TICKS + 20 * TICK_RATE; i++) {
        room.tick();
        bombs = Math.max(bombs, snapshot(alice).round.bombs.filter((bomb) => bomb.owner > 0).length);
      }
      const moved = snapshot(alice).round.players.slice(1).some((player, i) => player.x !== spawns[i + 1][0] || player.y !== spawns[i + 1][1]);
      expect(moved).toBe(true);
      expect(bombs).toBeGreaterThan(0);
    });

    it('restent partants pour la revanche, contrairement aux humains qui doivent le redire', () => {
      const room = new Room('ABCDE', () => 5);
      const alice = fakePeer('alice');
      const bob = fakePeer('bob');
      room.join(alice);
      room.join(bob);
      room.addBot('alice', 'pro');
      room.setReady('bob', true);
      expect(room.start('alice')).toBeNull();
      const players = lastOf(alice, 'lobby').players;
      expect(players.map((player) => player.ready)).toEqual([false, false, true]);
    });

    it('disparaissent avec le dernier joueur humain', () => {
      const room = new Room('ABCDE');
      const alice = fakePeer('alice');
      room.join(alice);
      room.addBot('alice', 'debutant');
      room.removeBot('alice', 'inconnu');
      expect(room.isEmpty).toBe(false);
      room.leave('alice');
      expect(room.isEmpty).toBe(true);
    });
  });
});
