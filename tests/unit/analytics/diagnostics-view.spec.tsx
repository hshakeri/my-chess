import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DiagnosticsView } from '../../../src/views/DiagnosticsView';
import { CANONICAL_HOOT65_GAMES } from '../../../src/analytics/diagnostics';
import { StoredGame } from '../../../src/types/db';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';

const seedGames = seedGamesRaw as unknown as StoredGame[];

const render = () => renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />).replace(/<!-- -->/g, '');

describe('DiagnosticsView Component', () => {
  it('renders without crashing and displays hoot65 diagnostic banner', () => {
    const html = render();

    expect(html).toContain('hoot65');
    expect(html).toContain('Personalized Diagnostics');
    expect(html).toContain('Games Analyzed');
    expect(html).toContain('White Win Rate');
    expect(html).toContain('Black Win Rate');
    expect(html).toContain('draws count half');
    // Exactly the fixture games, nothing injected
    expect(html).toContain(`data-stat="games-analyzed">${CANONICAL_HOOT65_GAMES.length}<`);
  });

  it('displays the White Scandinavian 2.e5?! leak and citations', () => {
    const html = render();

    expect(html).toContain('185031553576');
    expect(html).toContain('185035281692');
    expect(html).toContain('e5?!');
    expect(html).toContain('exd5!');
    expect(html).toContain('Scandinavian');
  });

  it('displays the Black early-queen leak citations and measured impact instead of a constant', () => {
    const html = render();

    expect(html).toContain('171894388406');
    expect(html).toContain('185129553252');
    expect(html).toContain('Qb6?!');
    expect(html).toContain('Score impact:');
    expect(html).not.toContain('+1.20');
    expect(html).not.toContain('-0.80');
    expect(html).toContain('Caro-Kann');
  });

  it('shows the ...Bg4 pattern as measured information on the archive, and as a leak only where it cost points', () => {
    // Whole archive: the ...Bg4 games scored better than the other Black games
    const archiveHtml = renderToString(<DiagnosticsView games={seedGames} />).replace(/<!-- -->/g, '');
    const strip = archiveHtml.slice(archiveHtml.indexOf('data-pattern="black-bg4-chase"'));
    expect(strip.slice(0, 1500)).toContain('Bg4');
    expect(strip.slice(0, 1500)).toContain('not costing points so far');
    expect(strip.slice(0, 1500)).toContain('>info<');

    // Fixtures: the single chased game was lost, so the same pattern is reported as a leak with its measured cost
    const html = render();
    const fixtureStrip = html.slice(html.indexOf('data-pattern="black-bg4-chase"'));
    expect(fixtureStrip.slice(0, 1500)).toContain('>leak<');
  });

  it('says plainly when a pattern has no comparison group instead of claiming it costs nothing', () => {
    const lone = CANONICAL_HOOT65_GAMES.filter((g) => g.id === '169098759508');
    const html = renderToString(<DiagnosticsView games={lone} />).replace(/<!-- -->/g, '');
    expect(html).toContain('no other black games to compare against yet');
    expect(html).not.toContain('not costing points so far');

    // An inferior-by-theory habit stays a leak, but its impact reads n/a rather than a made-up number
    const scandis = CANONICAL_HOOT65_GAMES.filter((g) =>
      ['185031553576', '185035281692', '184582182704', '171000270176'].includes(g.id)
    );
    const scandiHtml = renderToString(<DiagnosticsView games={scandis} />).replace(/<!-- -->/g, '');
    expect(scandiHtml).toContain('Score impact: n/a');
    expect(scandiHtml).toContain('no other white games to compare against yet');
  });

  it('displays tailored repertoire recommendation titles', () => {
    const html = render();

    expect(html).toContain('Italian Game &amp; Anti-Scandinavian');
    expect(html).toContain('Caro-Kann &amp; King&#x27;s Indian');
  });

  it('renders the shared 2D chessboard for the decision point with played and better-move arrows', () => {
    const html = render();

    expect(html).toContain('Decision Point Board');
    expect(html).toContain('data-board="decision-point"');
    expect(html).toContain('data-square="e4"');
    expect(html).toContain('data-overlay="cues"');
    // The first leak is the Scandinavian 2.e5 (red) with 2.exd5 (green)
    expect(html).toContain('data-arrow="e4e5"');
    expect(html).toContain('data-arrow="e4d5"');
    expect(html).toContain('>8<');
    expect(html).toContain('>a<');
    expect(html).toContain('>h<');
  });
});
