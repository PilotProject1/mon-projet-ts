import { BASE_MAX_BOMBS, BASE_RANGE, BASE_SPEED, SUDDEN_DEATH_TICKS, TICK_RATE } from '../src/game/constants';
import type { MatchState } from '../src/game/match';
import { Bonus, type ArenaId, type Player, type RoundEvent } from '../src/game/types';

const BONUS_KEYS: Record<Exclude<Bonus, 0>, string> = {
  [Bonus.Flame]: 'flamme',
  [Bonus.Bomb]: 'bombe',
  [Bonus.Speed]: 'vitesse',
  [Bonus.Vest]: 'gilet',
  [Bonus.Detonator]: 'detonateur',
  [Bonus.WallPass]: 'traverseMur',
  [Bonus.BombPass]: 'traverseBombe',
  [Bonus.Kick]: 'kick',
};

/** Bonus qu'un joueur possède en fin de manche, d'après ses caractéristiques. */
function heldBonuses(player: Player): Exclude<Bonus, 0>[] {
  const held: Exclude<Bonus, 0>[] = [];
  if (player.range > BASE_RANGE) held.push(Bonus.Flame);
  if (player.maxBombs > BASE_MAX_BOMBS) held.push(Bonus.Bomb);
  if (player.speed > BASE_SPEED + 1e-9) held.push(Bonus.Speed);
  if (player.vest) held.push(Bonus.Vest);
  if (player.detonator) held.push(Bonus.Detonator);
  if (player.wallPass) held.push(Bonus.WallPass);
  if (player.bombPass) held.push(Bonus.BombPass);
  if (player.kick) held.push(Bonus.Kick);
  return held;
}

interface BonusCounters {
  picked: number;
  /** Joueurs qui le possédaient en fin de manche. */
  held: number;
  /** Manches gagnées par un joueur qui le possédait. */
  heldByWinner: number;
}

/**
 * Statistiques de jeu anonymes (aucun pseudo, aucune adresse) pour équilibrer
 * les bonus et les arènes sur des parties réelles. En mémoire : remises à zéro
 * à chaque redémarrage du serveur.
 */
export class GameStats {
  private readonly since = new Date().toISOString();
  private matches = 0;
  private players = 0;
  private rounds = 0;
  private draws = 0;
  private suddenDeathRounds = 0;
  /** Somme, sur les manches, de 1 / nombre de joueurs : chance « normale » de gagner. */
  private baselineSum = 0;
  private readonly bonuses = new Map<Exclude<Bonus, 0>, BonusCounters>();
  private readonly arenas = new Map<ArenaId, { rounds: number; ticks: number }>();

  recordMatchStart(playerCount: number): void {
    this.matches++;
    this.players += playerCount;
  }

  recordEvents(events: RoundEvent[]): void {
    for (const event of events) {
      if (event.type === 'bonusPicked' && event.bonus !== Bonus.None) this.counters(event.bonus).picked++;
    }
  }

  recordRoundEnd(match: MatchState): void {
    const round = match.round;
    this.rounds++;
    if (match.roundWinner === null) this.draws++;
    if (round.tick >= SUDDEN_DEATH_TICKS) this.suddenDeathRounds++;
    const arena = this.arenas.get(round.arena) ?? { rounds: 0, ticks: 0 };
    arena.rounds++;
    arena.ticks += round.tick;
    this.arenas.set(round.arena, arena);
    if (match.roundWinner === null) return;
    this.baselineSum += 1 / round.players.length;
    for (const player of round.players) {
      for (const bonus of heldBonuses(player)) {
        const counters = this.counters(bonus);
        counters.held++;
        if (player.id === match.roundWinner) counters.heldByWinner++;
      }
    }
  }

  private counters(bonus: Exclude<Bonus, 0>): BonusCounters {
    let counters = this.bonuses.get(bonus);
    if (!counters) {
      counters = { picked: 0, held: 0, heldByWinner: 0 };
      this.bonuses.set(bonus, counters);
    }
    return counters;
  }

  /** Résumé lisible, servi sur /stats. */
  summary(): Record<string, unknown> {
    const decided = this.rounds - this.draws;
    const percent = (value: number) => Math.round(value * 1000) / 10;
    const bonuses: Record<string, unknown> = {};
    for (const [bonus, counters] of this.bonuses) {
      bonuses[BONUS_KEYS[bonus]] = {
        ramasses: counters.picked,
        // Chance de gagner la manche quand on le possède, à comparer à la chance normale.
        victoiresQuandPossede: counters.held ? `${percent(counters.heldByWinner / counters.held)} %` : null,
      };
    }
    const arenas: Record<string, unknown> = {};
    for (const [arena, { rounds, ticks }] of this.arenas) {
      arenas[arena] = { manches: rounds, dureeMoyenneSecondes: Math.round(ticks / rounds / TICK_RATE) };
    }
    return {
      depuis: this.since,
      matchs: this.matches,
      joueursParMatch: this.matches ? Math.round((this.players / this.matches) * 10) / 10 : null,
      manches: this.rounds,
      egalites: this.draws,
      manchesJusquAuResserrement: this.rounds ? `${percent(this.suddenDeathRounds / this.rounds)} %` : null,
      chanceNormaleDeGagner: decided ? `${percent(this.baselineSum / decided)} %` : null,
      bonus: bonuses,
      arenes: arenas,
    };
  }
}
