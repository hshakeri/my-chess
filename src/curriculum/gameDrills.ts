import { Chess, Square } from 'chess.js';
import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson, MistakeTrapInput, MoveInput, plyLabel } from './builder';
import { mentionsMove } from './factories';
import drillFile from '../data/game_drills.json';

/**
 * Four drill sets from hoot65's own games, picked by `scripts/game-analysis/drills.mjs` (see
 * docs/game-analysis.md): positions where the opponent's last move attacked a piece and hoot65 left
 * it there, positions where an enemy piece could be won and hoot65 did not take it, positions where
 * nothing was in danger until hoot65's own move left a piece where it could be taken, and positions
 * where hoot65's move let the opponent give mate at once.
 *
 * Each position is a one-decision lesson. The opponent's last move is replayed, then every move the
 * script's material search accepted is right (for the mate drills, those Stockfish also scores within
 * 1.5 pawns of its best move or as still winning by 3 pawns: `scripts/game-analysis/verify-drills.mjs`),
 * and the move played in the game is answered with what it cost. Every fact the text states (what attacks what, what defends it, what the reply captures) is
 * worked out here with chess.js from the position, so a drill whose data disagrees throws.
 */

export interface GameDrill {
  /** `<kind>-<Chess.com game id>-<ply>`. */
  id: string;
  url: string;
  date: string;
  opponent: string;
  color: 'white' | 'black';
  /** The position before the opponent's last move. */
  fenBefore: string;
  lastSan: string;
  /** hoot65's move in the game. */
  played: string;
  /** Every right answer, the main one first. */
  accepted: string[];
  /** Threat: the attacked piece of hoot65's; free: the enemy piece that could be won; hang: the piece the move played left in danger; mate: the square of the mate. */
  target: string;
  /** Threat and hang: the capture that punishes the move played; mate: the mate. */
  refutation?: string | null;
  /** Threat, hang and mate: whether the opponent played it in the game. */
  refutationPlayed?: boolean;
  /** Free only: the opponent's reply in the game. */
  reply?: string | null;
}

interface GameDrillFile {
  source: string;
  from: string;
  to: string;
  threat: GameDrill[];
  free: GameDrill[];
  hang: GameDrill[];
  mate?: GameDrill[];
}

export const gameDrillData = drillFile as GameDrillFile;

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const fail = (d: GameDrill, why: string): never => {
  throw new Error(`[Game drill] ${d.id}: ${why}`);
};

function play(d: GameDrill, fen: string, san: string) {
  const chess = new Chess(fen);
  try {
    const move = chess.move(san);
    return { chess, move };
  } catch {
    return fail(d, `'${san}' is not legal in ${fen}`);
  }
}

/** The cheapest piece of `color` attacking `square` that can actually take there (a king only takes an undefended piece). */
function cheapestAttacker(chess: Chess, square: Square, color: 'w' | 'b') {
  const defended = chess.attackers(square, color === 'w' ? 'b' : 'w').length > 0;
  const squares = chess.attackers(square, color).filter((s) => !(defended && chess.get(s)?.type === 'k'));
  return squares
    .map((s) => ({ square: s, type: chess.get(s)!.type }))
    .sort((a, b) => VALUE[a.type] - VALUE[b.type])[0];
}

/**
 * Why the piece on `square` can be won by `by`: nothing defends it, or a cheaper piece attacks it.
 * Throws when neither is true.
 */
function whyLoose(d: GameDrill, chess: Chess, square: Square, by: 'w' | 'b') {
  const piece = chess.get(square);
  if (!piece || piece.type === 'k' || piece.type === 'p') return fail(d, `no piece worth a minor or more on ${square}`);
  const attacker = cheapestAttacker(chess, square, by);
  if (!attacker) return fail(d, `nothing attacks ${square}`);
  const defended = chess.attackers(square, piece.color).length > 0;
  if (defended && VALUE[attacker.type] >= VALUE[piece.type]) return fail(d, `the piece on ${square} is defended and no cheaper piece attacks it`);
  return { piece: NAME[piece.type], attacker, defended };
}

/** "the knight on e5" for a capture (en passant takes the pawn beside the destination square). */
function captureText(move: { captured?: string; to: string; flags: string }): string {
  return move.flags.includes('e') ? 'a pawn en passant' : `the ${NAME[move.captured!]} on ${move.to}`;
}

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Whether the piece on `square` can be won by the other side: nothing defends it, or a cheaper piece attacks it. */
function isLoose(chess: Chess, square: Square): boolean {
  const piece = chess.get(square);
  if (!piece) return false;
  const attacker = cheapestAttacker(chess, square, piece.color === 'w' ? 'b' : 'w');
  if (!attacker) return false;
  return chess.attackers(square, piece.color).length === 0 || VALUE[attacker.type] < VALUE[piece.type];
}

/** `color`'s pieces (a minor piece or more) that can be won in `chess`, most valuable first. */
function looseOf(chess: Chess, color: 'w' | 'b') {
  const out: Array<{ square: Square; piece: string; value: number; attacker: { square: Square; type: string } }> = [];
  for (const row of chess.board()) {
    for (const pc of row) {
      if (!pc || pc.color !== color || pc.type === 'p' || pc.type === 'k' || !isLoose(chess, pc.square)) continue;
      out.push({ square: pc.square, piece: NAME[pc.type], value: VALUE[pc.type], attacker: cheapestAttacker(chess, pc.square, color === 'w' ? 'b' : 'w')! });
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/** `color`'s pieces that can be won in `now` and could not be from the same square in `before`, most valuable first. */
function newlyLoose(now: Chess, before: Chess, color: 'w' | 'b') {
  return looseOf(now, color).filter((x) => !isLoose(before, x.square));
}

const PREFIX = 'lesson-game-';

/** Whether a lesson is one of the drill positions from hoot65's games. */
export const isGameDrill = (lessonId: string): boolean => lessonId.startsWith(PREFIX);

/** A drill position as a one-decision lesson. */
export function lessonFromGameDrill(d: GameDrill, kind: 'threat' | 'free' | 'hang' | 'mate'): CurriculumLesson {
  const me: 'w' | 'b' = d.color === 'white' ? 'w' : 'b';
  const them: 'w' | 'b' = me === 'w' ? 'b' : 'w';
  const { chess: board, move: last } = play(d, d.fenBefore, d.lastSan);
  const fen = board.fen();
  if (board.turn() !== me) fail(d, `${d.color} is not to move after ${d.lastSan}`);
  const target = d.target as Square;

  const lastLabel = plyLabel(d.fenBefore, 0, last.san);
  const moveNumber = Number(fen.split(' ')[5]);
  const playedMove = play(d, fen, d.played);
  const playedLabel = plyLabel(fen, 0, playedMove.move.san);
  if (d.accepted.length === 0) fail(d, 'no accepted move');
  const accepted = d.accepted.map((san) => play(d, fen, san).move.san);
  if (accepted.includes(playedMove.move.san)) fail(d, `the move played, ${d.played}, is also accepted`);
  const [main, ...others] = accepted;

  let opponentNote: string;
  let rightNote: string;
  let playedNote: string;
  let takeaway: string;
  let hintTheme: string;
  let otherWrong: string;
  /** The feedback for a wrong move other than the game's, when it depends on the move. */
  let wrongFor: (san: string) => string = () => otherWrong;
  const mistakes: MistakeTrapInput[] = [];

  if (kind === 'free') {
    const loose = whyLoose(d, board, target, me);
    if (board.get(target)?.color !== them) fail(d, `the piece on ${target} is not the opponent's`);
    const takes = accepted.filter((san) => {
      const m = new Chess(fen).move(san);
      return m.to === target && !!m.captured;
    });
    if (takes.length === 0) fail(d, `no accepted move takes on ${target}`);
    const reason = loose.defended
      ? `your ${NAME[loose.attacker.type]} on ${loose.attacker.square} attacked it, and a ${NAME[loose.attacker.type]} is worth less than a ${loose.piece}`
      : 'nothing defended it';
    opponentNote = `${lastLabel} in your game vs ${d.opponent}. Before you move: can you win something?`;
    // What the game's reply did next: a capture, or the free piece moving away
    let afterwards = '';
    if (d.reply) {
      const reply = play(d, playedMove.chess.fen(), d.reply);
      const replyLabel = plyLabel(playedMove.chess.fen(), 0, reply.move.san);
      if (reply.move.captured) afterwards = `, and ${replyLabel} took ${captureText(reply.move)}`;
      else if (reply.move.from === target) afterwards = `, and ${replyLabel} moved the ${loose.piece} away`;
    }
    rightNote = `In the game you played ${playedLabel}${afterwards}.`;
    playedNote = `This is what you played vs ${d.opponent} on ${d.date}. The ${loose.piece} on ${target} could have been won: ${reason}.`;
    takeaway = `Before every move, look for a piece of theirs that can be won. Here the ${loose.piece} on ${target} could be taken: ${reason}.`;
    hintTheme = 'One of the opponent’s pieces can be won.';
    otherWrong = 'Not this one. Look at each of the opponent’s pieces: what attacks it, and what defends it?';
    wrongFor = (san) => {
      const m = play(d, fen, san).move;
      return m.to === target && m.captured ? `That takes the ${loose.piece}, but there is a better move.` : otherWrong;
    };
  } else if (kind === 'mate') {
    // The move played let the opponent mate at once; no answer does
    if (!d.refutation) fail(d, 'no mate');
    const mate = play(d, playedMove.chess.fen(), d.refutation!);
    if (!mate.chess.isCheckmate()) fail(d, `${d.refutation} is not mate after ${d.played}`);
    for (const san of accepted) {
      if (play(d, fen, san).chess.moves().some((m) => m.endsWith('#'))) fail(d, `the answer ${san} allows mate in one`);
    }
    const mateLabel = plyLabel(playedMove.chess.fen(), 0, mate.move.san);
    opponentNote = `${lastLabel} in your game vs ${d.opponent}. Before you move: after your move, can your opponent give mate?`;
    rightNote = d.refutationPlayed
      ? `In the game you played ${playedLabel}, and ${mateLabel} was mate.`
      : `In the game you played ${playedLabel}; ${mateLabel} would have been mate.`;
    playedNote = `This is what you played vs ${d.opponent} on ${d.date}: ${mateLabel} is mate.`;
    takeaway = `Before every move, look at the checks your opponent would have after it. After ${playedLabel}, ${mateLabel} is mate.`;
    hintTheme = 'After your move, look at every check your opponent would have.';
    otherWrong = 'Not this one. After it, which checks would your opponent have, and is one of them mate?';
    // A move that stops the mate is still wrong when Stockfish finds it much worse than the answers
    const stopsIt = 'That stops the mate, but it costs you more than it should: there is a stronger move.';
    wrongFor = (san) => (play(d, fen, san).chess.moves().some((m) => m.endsWith('#')) ? otherWrong : stopsIt);
    mistakes.push({
      triggerFen: fen,
      attemptedSan: playedMove.move.san,
      isTrap: false,
      severity: 'blunder',
      explanatoryFeedback: playedNote,
      refutationSanList: [mate.move.san],
      punishmentSummary: '',
    });
  } else {
    // A threat or a hang drill: the move played let the opponent capture, and that capture is replayed
    if (!d.refutation) fail(d, 'no refutation');
    const punish = play(d, playedMove.chess.fen(), d.refutation!);
    if (!punish.move.captured) fail(d, `the refutation ${d.refutation} captures nothing`);
    const punishLabel = plyLabel(playedMove.chess.fen(), 0, punish.move.san);
    const took = captureText(punish.move);
    rightNote = d.refutationPlayed
      ? `In the game you played ${playedLabel}, and ${punishLabel} took ${took}.`
      : `In the game you played ${playedLabel}; ${punishLabel} would have taken ${took}.`;
    playedNote = `This is what you played vs ${d.opponent} on ${d.date}: ${punishLabel} takes ${took}.`;
    mistakes.push({
      triggerFen: fen,
      attemptedSan: playedMove.move.san,
      isTrap: false,
      severity: 'blunder',
      explanatoryFeedback: playedNote,
      refutationSanList: [punish.move.san],
      punishmentSummary: '',
    });

    if (kind === 'threat') {
      const loose = whyLoose(d, board, target, them);
      if (board.get(target)?.color !== me) fail(d, `the piece on ${target} is not ${d.color}'s`);
      // Everything the last move put in danger: the moved piece's own attacks, then lines it opened
      const endangered = newlyLoose(board, new Chess(d.fenBefore), me);
      if (!endangered.some((x) => x.square === target)) fail(d, `the piece on ${target} was not put in danger by ${d.lastSan}`);
      const hit = endangered.filter((x) => board.attackers(x.square, them).includes(last.to as Square));
      const opened = endangered.filter((x) => !hit.includes(x));
      const parts: string[] = [];
      if (hit.length) parts.push(`attacked ${listOf(hit.map((x) => `the ${x.piece} on ${x.square}`))}`);
      for (const x of opened) parts.push(`opened the line of the ${NAME[x.attacker.type]} on ${x.attacker.square} to the ${x.piece} on ${x.square}`);
      const opener = `${lastLabel} ${parts.join(', and ')}`;
      const reason = loose.defended
        ? `. A ${NAME[loose.attacker.type]} is worth less than a ${loose.piece}, so the ${loose.piece} on ${target} could be won.`
        : `. Nothing defended the ${loose.piece} on ${target}.`;
      opponentNote = `${lastLabel} in your game vs ${d.opponent}. What does it attack?`;
      takeaway = `After every opponent move, ask what it attacks. ${opener}${reason}`;
      hintTheme = `${lastLabel} attacks one of your pieces.`;
      otherWrong = `Not this one. What does ${lastLabel} attack, and is it defended?`;
      // A move that saves the piece is still wrong when it leaves another one to take, or Stockfish finds better
      wrongFor = (san) => {
        const { chess: after, move } = play(d, fen, san);
        const square = move.from === target ? (move.to as Square) : target;
        if (after.get(square)?.color !== me || isLoose(after, square)) return otherWrong;
        const left = looseOf(after, me)[0];
        return left
          ? `That saves the ${loose.piece}, but then the ${left.piece} on ${left.square} can be won.`
          : `That saves the ${loose.piece}, but there is a better move.`;
      };
    } else {
      // Nothing of either side was in danger; the move played put the piece on the target square in danger
      if (looseOf(board, me).length || looseOf(board, them).length) fail(d, 'something was already in danger before the move');
      if (playedMove.chess.get(target)?.color !== me) fail(d, `the piece on ${target} is not ${d.color}'s after ${d.played}`);
      if (!newlyLoose(playedMove.chess, board, me).some((x) => x.square === target)) fail(d, `${d.played} did not put the piece on ${target} in danger`);
      const loose = whyLoose(d, playedMove.chess, target, them);
      const reason = loose.defended
        ? `the ${NAME[loose.attacker.type]} on ${loose.attacker.square} attacked it, and a ${NAME[loose.attacker.type]} is worth less than a ${loose.piece}`
        : 'nothing defended it';
      opponentNote = `${lastLabel} in your game vs ${d.opponent}. Before you move: what could they take after your move?`;
      takeaway = `Before every move, ask what your opponent could take after it. After ${playedLabel}, the ${loose.piece} on ${target} could be taken: ${reason}.`;
      hintTheme = 'Before you play a move, check what your opponent could take after it.';
      otherWrong = 'Not this one. After it, what could your opponent take?';
      wrongFor = (san) => (looseOf(play(d, fen, san).chess, me).length ? otherWrong : 'That leaves nothing to take, but there is a better move.');
    }
  }

  // Every legal move that is not an answer gets the drill's own question; the game move gets its story
  const wrongMoveFeedback: Record<string, string> = {};
  for (const san of new Chess(fen).moves()) if (!accepted.includes(san)) wrongMoveFeedback[san] = wrongFor(san);
  wrongMoveFeedback[playedMove.move.san] = playedNote;

  const sideName = d.color === 'white' ? 'White' : 'Black';
  const title = `Your game vs ${d.opponent}, move ${moveNumber}`;
  if (accepted.some((san) => mentionsMove(title, san))) fail(d, 'the title would print the answer');

  const moves: MoveInput[] = [
    { san: last.san, isUserMove: false, annotation: opponentNote },
    {
      san: main,
      isUserMove: true,
      accept: others.length > 0 ? { san: others } : undefined,
      annotation: rightNote,
      hintTheme,
      wrongMoveFeedback,
    },
  ];

  return buildVerifiedLesson({
    id: `${PREFIX}${d.id}`,
    title,
    subtitle:
      kind === 'threat'
        ? `${d.date} · What does ${lastLabel} attack?`
        : kind === 'free'
          ? `${d.date} · Can you win something?`
          : kind === 'mate'
            ? `${d.date} · Does your move allow mate?`
            : `${d.date} · Is your move safe?`,
    category: 'weakness_drill',
    sourceBook: 'hoot65 Chess.com archive',
    author: 'hoot65 game analysis',
    publicationYear: Number(d.date.slice(0, 4)),
    initialFen: d.fenBefore,
    description: `${sideName} in your game vs ${d.opponent} on ${d.date} (${d.url}).`,
    thematicObjective: takeaway,
    keyTacticalMotif:
      kind === 'threat'
        ? 'Answer the threat: move or guard the attacked piece'
        : kind === 'free'
          ? 'Win the loose piece'
          : kind === 'mate'
            ? 'Blunder check: the checks your opponent would have after your move'
            : 'Blunder check: leave nothing where it can be taken',
    targetColor: d.color,
    targetRatingBand: 'beginner',
    startPly: 0,
    relevance: 'core',
    moves,
    exercises: [],
    mistakesAndTraps: mistakes,
  });
}

/** Threat drills: the opponent's last move attacked a piece that was left where it was. */
export const missedThreatLessons: CurriculumLesson[] = gameDrillData.threat.map((d) => lessonFromGameDrill(d, 'threat'));

/** Free-piece drills: an enemy piece could be won and was not taken. */
export const freePieceLessons: CurriculumLesson[] = gameDrillData.free.map((d) => lessonFromGameDrill(d, 'free'));

/** Hanging-move drills: nothing was in danger, and the move played left a piece where it could be taken. */
export const hangingMoveLessons: CurriculumLesson[] = gameDrillData.hang.map((d) => lessonFromGameDrill(d, 'hang'));

/** Mate drills: the move played let the opponent mate at once. */
export const allowedMateLessons: CurriculumLesson[] = (gameDrillData.mate ?? []).map((d) => lessonFromGameDrill(d, 'mate'));

export const gameDrillLessons: CurriculumLesson[] = [...missedThreatLessons, ...freePieceLessons, ...hangingMoveLessons, ...allowedMateLessons];

/** The drill set a lesson belongs to (threats, free pieces, hanging moves or allowed mates), if it is a game drill. */
export function drillSetOf(lessonId: string): CurriculumLesson[] | undefined {
  return [missedThreatLessons, freePieceLessons, hangingMoveLessons, allowedMateLessons].find((set) => set.some((l) => l.id === lessonId));
}
