import { describe, expect, it } from 'vitest';
import { COUNTDOWN_TICKS } from '../src/game/constants';
import type { ServerMessage } from '../src/net/protocol';
import { applyBonus } from '../src/game/round';
import { Bonus } from '../src/game/types';
import { createPeer, Room } from '../src/net/room';
import { GameStats } from './stats';

describe('statistiques d’équilibrage', () => {
  it('compte les matchs, les manches et les bonus des gagnants, sans aucun pseudo', () => {
    const stats = new GameStats();
    const room = new Room('ABCDE', () => 1, stats);
    const inbox: ServerMessage[] = [];
    const alice = createPeer('alice', 't1', 'Alice', (message) => inbox.push(message));
    const bob = createPeer('bob', 't2', 'Bob', () => {});
    room.join(alice);
    room.join(bob);
    room.setArena('alice', 'temple');
    room.setReady('bob', true);
    room.start('alice');
    for (let i = 0; i < COUNTDOWN_TICKS + 1; i++) room.tick();
    const match = (inbox.filter((message) => message.type === 'snapshot').pop() as Extract<ServerMessage, { type: 'snapshot' }>).match;
    expect(match.phase).toBe('playing');
    // Alice a un Kick ; Bob se déconnecte et perd la manche après la période de grâce.
    // (On passe par l'état interne du salon via un nouvel instantané.)
    const internal = (room as unknown as { match: { round: { players: Parameters<typeof applyBonus>[0][] } } }).match;
    applyBonus(internal.round.players[0], Bonus.Kick);
    room.leave('bob');
    for (let i = 0; i < 3; i++) room.tick();
    const summary = stats.summary();
    expect(summary.matchs).toBe(1);
    expect(summary.manches).toBe(1);
    expect(summary.egalites).toBe(0);
    expect(summary.bonus).toMatchObject({ kick: { victoiresQuandPossede: '100 %' } });
    expect(summary.arenes).toMatchObject({ temple: { manches: 1 } });
    expect(JSON.stringify(summary)).not.toMatch(/Alice|Bob/);
  });
});
