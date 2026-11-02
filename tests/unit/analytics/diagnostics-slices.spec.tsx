// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { analyzeGames, analyzeGamesInSlices, DiagnosticAnalyzer } from '../../../src/analytics/diagnostics';
import { DiagnosticsView, READ_AT_ONCE } from '../../../src/views/DiagnosticsView';
import type { StoredGame } from '../../../src/types/db';
import type { DiagnosticReport } from '../../../src/types/diagnostics';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';

const seedGames = seedGamesRaw as unknown as StoredGame[];
const sameReport = (r: DiagnosticReport) => JSON.stringify({ ...r, generatedAt: 0 });

describe('Diagnostics on a big archive', () => {
  afterEach(() => cleanup());

  it('reads the games in slices into the same report, saying how far it is, and stops when asked', async () => {
    const progress: number[] = [];
    const report = await new Promise<DiagnosticReport>((resolve) => {
      analyzeGamesInSlices(seedGames, 'hoot65', resolve, (read, total) => {
        expect(total).toBe(seedGames.length);
        progress.push(read);
      }, 1);
    });
    expect(sameReport(report)).toBe(sameReport(analyzeGames(seedGames, 'hoot65')));
    expect(progress.length).toBeGreaterThan(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));

    let done = false;
    const stop = analyzeGamesInSlices(seedGames, 'hoot65', () => (done = true), undefined, 1);
    stop();
    await new Promise((r) => setTimeout(r, 300));
    expect(done).toBe(false);
  });

  it('reads the final position from the PGN only to skip a replay: the result findings match a full replay', () => {
    // A copy of the move list is not the game's own, so the detectors replay the whole game as before
    for (const g of seedGames) {
      for (const color of ['white', 'black'] as const) {
        expect(DiagnosticAnalyzer.detectMatedWhileAhead(g, g.movesSan, color)).toEqual(DiagnosticAnalyzer.detectMatedWhileAhead(g, [...g.movesSan], color));
        expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(g, g.movesSan, color)).toEqual(
          DiagnosticAnalyzer.detectLostOnTimeWhileAhead(g, [...g.movesSan], color)
        );
      }
    }
  });

  it('shows the reading on the report tabs, then the report, for an archive too big to read at once', async () => {
    const games: StoredGame[] = [];
    for (let k = 0; games.length <= READ_AT_ONCE; k++) for (const g of seedGames) games.push({ ...g, id: `${g.id}-${k}` });
    const { container } = render(<DiagnosticsView games={games} />);
    expect(container.querySelector('[data-section="diagnostics-reading"]')).not.toBeNull();
    expect(container.querySelector('[data-stat="games-analyzed"]')?.textContent).toBe('…');
    // The archive's own card stays up meanwhile
    expect(container.querySelector('[data-section="points"]')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('[data-stat="games-analyzed"]')?.textContent).toBe(String(games.length)), { timeout: 20_000 });
    expect(container.querySelector('[data-section="diagnostics-reading"]')).toBeNull();
    expect(screen.getAllByText(/Scandinavian/).length).toBeGreaterThan(0);
  }, 30_000);
});
