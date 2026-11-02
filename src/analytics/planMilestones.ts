import { Chess } from 'chess.js';
import type { PlanMilestone } from '../types/curriculum';

/**
 * Plan goals checked on a spar (CL-6): after the student has played a lesson's position on against
 * Maia, which goals of the plan were reached, and when. Every spar has the goals in DEFAULT_MILESTONES;
 * a lesson can add its own (`planMilestones`).
 */

export const DEFAULT_MILESTONES: PlanMilestone[] = [{ kind: 'castle' }, { kind: 'develop' }, { kind: 'keep_material' }];

export interface MilestoneResult {
  label: string;
  /** 'already': true when the spar began; 'met': reached during it; 'missed': not reached by its end. */
  status: 'already' | 'met' | 'missed';
  /** The ply of the spar (0 = its first move) at which it was reached. */
  ply?: number;
  detail?: string;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(chess: Chess, color: 'w' | 'b'): number {
  let s = 0;
  for (const row of chess.board()) for (const pc of row) if (pc) s += (pc.color === color ? 1 : -1) * VALUE[pc.type];
  return s;
}

const HOME = { w: { n: ['b1', 'g1'], b: ['c1', 'f1'] }, b: { n: ['b8', 'g8'], b: ['c8', 'f8'] } } as const;

/** Every knight and bishop of `color` is off its starting square (pieces that left the board count as out). */
function developed(chess: Chess, color: 'w' | 'b'): boolean {
  for (const type of ['n', 'b'] as const) {
    for (const sq of HOME[color][type]) {
      const pc = chess.get(sq as never);
      if (pc && pc.color === color && pc.type === type) return false;
    }
  }
  return true;
}

/** The king has castled: it stands on a castled square and has no castling right left. */
function castled(chess: Chess, color: 'w' | 'b'): boolean {
  const rights = chess.fen().split(' ')[2];
  const hasRight = color === 'w' ? /[KQ]/.test(rights) : /[kq]/.test(rights);
  const squares = color === 'w' ? ['g1', 'c1', 'b1', 'h1'] : ['g8', 'c8', 'b8', 'h8'];
  return !hasRight && squares.some((sq) => {
    const pc = chess.get(sq as never);
    return !!pc && pc.type === 'k' && pc.color === color;
  });
}

const bishops = (chess: Chess, color: 'w' | 'b') => chess.board().flat().filter((p) => p && p.color === color && p.type === 'b').length;

function defaultLabel(m: PlanMilestone): string {
  if (m.label) return m.label;
  switch (m.kind) {
    case 'castle':
      return 'Castle';
    case 'develop':
      return 'Bring out every knight and bishop';
    case 'keep_material':
      return 'Keep the material';
    case 'bishop_pair':
      return 'Keep both bishops';
    default:
      return m.label;
  }
}

/**
 * Which milestones the spar reached. `startFen` is the position the spar began from, `moves` its moves
 * (both sides, from the start position), `color` the student's side.
 */
export function evaluateMilestones(startFen: string, moves: string[], color: 'w' | 'b', milestones: PlanMilestone[]): MilestoneResult[] {
  // The position after every ply, the start included
  const positions: Chess[] = [new Chess(startFen)];
  const played: Array<{ san: string; color: 'w' | 'b'; piece: string; to: string }> = [];
  for (const san of moves) {
    const c = new Chess(positions[positions.length - 1].fen());
    const m = c.move(san);
    played.push({ san: m.san, color: m.color, piece: m.piece, to: m.to });
    positions.push(c);
  }
  const start = positions[0];
  const end = positions[positions.length - 1];
  /** The first ply after which `test` holds in the position, counting only the student's moves. */
  const firstAfterOwnMove = (test: (c: Chess) => boolean) => played.findIndex((p, i) => p.color === color && test(positions[i + 1]));

  return milestones.map((m): MilestoneResult => {
    const label = defaultLabel(m);
    switch (m.kind) {
      case 'castle': {
        if (castled(start, color)) return { label, status: 'already' };
        const ply = played.findIndex((p) => p.color === color && p.san.startsWith('O-O'));
        return ply >= 0 ? { label, status: 'met', ply } : { label, status: 'missed' };
      }
      case 'develop': {
        if (developed(start, color)) return { label, status: 'already' };
        const ply = firstAfterOwnMove((c) => developed(c, color));
        return ply >= 0 ? { label, status: 'met', ply } : { label, status: 'missed' };
      }
      case 'keep_material': {
        // Counted where the spar ends: a pawn given up is material lost
        const change = material(end, color) - material(start, color);
        if (change >= 0) return { label, status: 'met', detail: change > 0 ? `${change === 1 ? 'a pawn' : `${change} points`} up` : undefined };
        return { label, status: 'missed', detail: `${change === -1 ? 'a pawn' : `${-change} points of material`} down at the end` };
      }
      case 'pawn_to': {
        const pc = start.get(m.square as never);
        if (pc && pc.type === 'p' && pc.color === color) return { label, status: 'already' };
        const ply = played.findIndex((p) => p.color === color && p.piece === 'p' && p.to === m.square);
        return ply >= 0 ? { label, status: 'met', ply } : { label, status: 'missed' };
      }
      case 'piece_on': {
        const on = (c: Chess) => {
          const pc = c.get(m.square as never);
          return !!pc && pc.color === color && pc.type === m.piece;
        };
        if (on(start)) return { label, status: 'already' };
        const ply = firstAfterOwnMove(on);
        return ply >= 0 ? { label, status: 'met', ply } : { label, status: 'missed' };
      }
      case 'bishop_pair': {
        if (bishops(start, color) < 2) return { label, status: 'missed', detail: 'the spar began without both bishops' };
        return bishops(end, color) >= 2 ? { label, status: 'met' } : { label, status: 'missed' };
      }
    }
  });
}
