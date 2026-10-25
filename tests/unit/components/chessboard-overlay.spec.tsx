import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Chessboard, MAX_BOARD_CUES } from '../../../src/components/Chessboard';
import { RulesEngine } from '../../../src/engine/rules';

function renderBoard(props: Partial<React.ComponentProps<typeof Chessboard>> = {}) {
  const engine = new RulesEngine();
  return renderToString(
    <Chessboard board={engine.getBoard()} position={engine.getPosition()} interactive={false} {...props} />
  );
}

describe('Chessboard coaching overlay (arrows and highlights)', () => {
  it('renders no overlay when there are no cues', () => {
    const html = renderBoard();
    expect(html).not.toContain('data-overlay="cues"');
    expect(html).toContain('data-square="e4"');
  });

  it('draws an arrow and a highlight in an 8x8 viewBox without touching the square grid', () => {
    const html = renderBoard({
      arrows: [{ from: 'c3', to: 'd5', color: 'red' }],
      highlights: [{ square: 'f7', color: 'yellow' }],
    });
    expect(html).toContain('data-overlay="cues"');
    expect(html).toContain('viewBox="0 0 8 8"');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('data-arrow="c3d5"');
    expect(html).toContain('data-square-cue="f7"');
    // Grid contract used by the E2E suite is intact: 64 squares
    expect((html.match(/data-square="/g) || []).length).toBe(64);
  });

  it('places arrow endpoints at square centres and respects the board orientation', () => {
    // From White's side: c3 is file index 2, rank index 5 (ranks 8..1) -> centre (2.5, 5.5)
    const white = renderBoard({ arrows: [{ from: 'c3', to: 'd5' }] });
    expect(white).toMatch(/x1="2\.5"/);
    expect(white).toMatch(/y1="5\.5"/);
    // From Black's side the same square is mirrored: file index 5, rank index 2 -> centre (5.5, 2.5)
    const black = renderBoard({ orientation: 'b', arrows: [{ from: 'c3', to: 'd5' }] });
    expect(black).toMatch(/x1="5\.5"/);
    expect(black).toMatch(/y1="2\.5"/);
  });

  it('caps the number of cues so coaching stays sparse', () => {
    const arrows = ['a1a2', 'b1b2', 'c1c2', 'd1d2', 'e1e2'].map((s) => ({ from: s.slice(0, 2), to: s.slice(2) }));
    const html = renderBoard({ arrows });
    expect(MAX_BOARD_CUES).toBe(3);
    expect((html.match(/data-cue="arrow"/g) || []).length).toBe(3);
  });

  it('ignores cues on squares that do not exist', () => {
    const html = renderBoard({ arrows: [{ from: 'z9', to: 'e4' }], highlights: [{ square: 'i1' }] });
    expect(html).not.toContain('data-cue="arrow"');
    expect(html).not.toContain('data-cue="highlight"');
  });
});
