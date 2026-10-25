import { ChessMoveRecord, GameHeaders } from '../types/chess';

export interface ParsedPgnGame {
  headers: GameHeaders;
  movesSan: string[];
  comments: Record<number, string>;
  result: string;
  rawPgn: string;
}

export class PgnHandler {
  /**
   * Split a multi-game PGN string into individual game chunks.
   */
  public static splitMultiGamePgn(pgnText: string): string[] {
    const games: string[] = [];
    const trimmed = pgnText.trim();
    if (!trimmed) return games;

    // Split on game boundary: [Event "..."
    const parts = trimmed.split(/(?=\[Event\s+"[^"]*"\])/gi);
    for (const part of parts) {
      const clean = part.trim();
      if (clean) {
        games.push(clean);
      }
    }

    if (games.length === 0 && trimmed) {
      games.push(trimmed);
    }
    return games;
  }

  /**
   * Parse headers and clean moves from a single PGN.
   */
  public static parsePgn(pgnText: string): ParsedPgnGame {
    const headers: GameHeaders = {};
    const comments: Record<number, string> = {};
    const lines = pgnText.split(/\r?\n/);
    const moveLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const match = trimmed.match(/\[([A-Za-z0-9_]+)\s+"(.*)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      } else if (trimmed) {
        moveLines.push(trimmed);
      }
    }

    const moveText = moveLines.join(' ');
    // Remove comments while recording them
    let commentIndex = 0;
    const cleanMoveText = moveText.replace(/\{([^}]+)\}/g, (_match, comment) => {
      commentIndex++;
      comments[commentIndex] = comment.trim();
      return '';
    });

    // Remove NAGs like $1, $2, etc.
    const withoutNags = cleanMoveText.replace(/\$\d+/g, '');

    // Extract individual tokens
    const tokens = withoutNags.split(/\s+/).filter(Boolean);
    const movesSan: string[] = [];
    let result = headers.Result || '*';

    for (const token of tokens) {
      if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) {
        result = token;
        continue;
      }
      // Skip move numbers like "1.", "12...", "4."
      if (/^\d+\.+$/.test(token)) {
        continue;
      }
      // If token starts with number like "1.e4", strip the prefix
      const cleanToken = token.replace(/^\d+\.+/, '');
      if (cleanToken && !['1-0', '0-1', '1/2-1/2', '*'].includes(cleanToken)) {
        movesSan.push(cleanToken);
      }
    }

    return {
      headers,
      movesSan,
      comments,
      result,
      rawPgn: pgnText.trim(),
    };
  }

  /**
   * Serialize game headers and moves to standard PGN string.
   */
  public static serializePgn(
    headers: GameHeaders,
    history: ChessMoveRecord[],
    result: string = '*'
  ): string {
    const standardHeaderOrder = [
      'Event',
      'Site',
      'Date',
      'Round',
      'White',
      'Black',
      'Result',
      'WhiteElo',
      'BlackElo',
      'ECO',
    ];

    const lines: string[] = [];
    const usedHeaders = new Set<string>();

    for (const key of standardHeaderOrder) {
      if (headers[key] !== undefined) {
        lines.push(`[${key} "${headers[key]}"]`);
        usedHeaders.add(key);
      }
    }

    // Add any remaining headers
    for (const [key, val] of Object.entries(headers)) {
      if (!usedHeaders.has(key) && val !== undefined) {
        lines.push(`[${key} "${val}"]`);
      }
    }

    lines.push(''); // blank line before moves

    let moveText = '';
    for (let i = 0; i < history.length; i++) {
      const rec = history[i];
      if (i % 2 === 0) {
        const moveNumber = Math.floor(i / 2) + 1;
        moveText += `${moveNumber}. ${rec.san}`;
      } else {
        moveText += ` ${rec.san}`;
      }

      if (rec.comment) {
        moveText += ` {${rec.comment}}`;
      }
      moveText += ' ';
    }

    moveText += result;
    lines.push(moveText.trim());

    return lines.join('\n');
  }
}
