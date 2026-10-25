import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DiagnosticsView } from '../../../src/views/DiagnosticsView';
import { CANONICAL_HOOT65_GAMES } from '../../../src/analytics/diagnostics';

describe('DiagnosticsView Component', () => {
  it('renders without crashing and displays hoot65 diagnostic banner', () => {
    const html = renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />);

    expect(html).toContain('hoot65');
    expect(html).toContain('Personalized Diagnostics');
    expect(html).toContain('Games Analyzed');
    expect(html).toContain('White Win Rate');
    expect(html).toContain('Black Win Rate');
  });

  it('displays the White Scandinavian 2.e5?! leak and citations', () => {
    const rawHtml = renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />);
    const html = rawHtml.replace(/<!-- -->/g, '');

    expect(html).toContain('185031553576');
    expect(html).toContain('185035281692');
    expect(html).toContain('e5?!');
    expect(html).toContain('exd5!');
    expect(html).toContain('Scandinavian');
  });

  it('displays the Black premature ...Bg4 leak citations', () => {
    const rawHtml = renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />);
    const html = rawHtml.replace(/<!-- -->/g, '');

    expect(html).toContain('185282462950');
    expect(html).toContain('173676860416');
    expect(html).toContain('Bg4?!');
    expect(html).toContain('Caro-Kann');
  });

  it('displays tailored repertoire recommendation titles', () => {
    const html = renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />);

    expect(html).toContain('Italian Game &amp; Anti-Scandinavian');
    expect(html).toContain('Caro-Kann &amp; King&#x27;s Indian');
  });

  it('renders interactive 2D chessboard squares and coordinates', () => {
    const html = renderToString(<DiagnosticsView games={CANONICAL_HOOT65_GAMES} />);

    expect(html).toContain('Decision Point Board');
    // Board rank and file coordinates
    expect(html).toContain('8');
    expect(html).toContain('a');
    expect(html).toContain('h');
  });
});
