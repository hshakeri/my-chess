import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MoveTree } from '../../../src/components/MoveTree';
import { evansGambitDestruction } from '../../../src/curriculum/openings';
import { scandinavianRefutationDrill } from '../../../src/curriculum/drills';
import { queenCageBoxMate } from '../../../src/curriculum/fundamentals';

const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];

/** The `<li ...>` opening tag for a node with the given data-path. */
function nodeTag(html: string, path: string): string | undefined {
  const m = html.match(new RegExp(`<li[^>]*data-path="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`));
  return m?.[0];
}

describe('MoveTree (SSR)', () => {
  it('renders the main line as a lesson tree with one node per move', () => {
    const html = renderToString(<MoveTree lesson={evansGambitDestruction} currentPath={[]} />);
    expect(html).toContain('data-tree="lesson"');
    for (const move of evansGambitDestruction.moves) expect(html).toContain(`data-node="${move.san}"`);
    expect(html).toContain('>1.e4<');
    expect(html).toContain('>1...e5<');
    expect(html).toContain('>3...Bc5<');
    expect(html).not.toContain('data-current="true"');
  });

  it('marks the current node, expands the branch on the current path and keeps the others collapsed', () => {
    const html = renderToString(<MoveTree lesson={evansGambitDestruction} currentPath={[...ITALIAN, 'Nf6']} />);
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Nf6')).toContain('data-current="true"');
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Nf6')).toContain('data-branch="true"');
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Bc5')).not.toContain('data-current');
    expect((html.match(/data-current="true"/g) || []).length).toBe(1);
    // The Two Knights continuation is rendered because the current path runs through it
    expect(html).toContain('data-node="d3"');
    expect(html).toContain('>4.d3<');
    // The other branches are collapsed: their continuations are not in the DOM
    expect(html).not.toContain('data-node="Qb3"');
    expect(html).not.toContain('data-node="a4"');
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Nd4')).toContain('data-expanded="false"');
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Nf6')).toContain('data-expanded="true"');
  });

  it('shows each reply share as a small percentage next to the scripted reply and its alternatives', () => {
    const html = renderToString(<MoveTree lesson={evansGambitDestruction} currentPath={[]} />);
    // 3.Bc4: Bc5 11, Nf6 12, Nd4 5, h6 16 of 44
    expect(html).toContain('data-share="25"');
    expect(html).toContain('>25%<');
    expect(html).toContain('>27%<');
    expect(html).toContain('>11%<');
    expect(html).toContain('>36%<');
    // 4.b4: Bxb4 7 of 7 against the unobserved ...Bb6
    expect(html).toContain('>88%<');
    expect(html).toContain('>13%<');
    // A move without alternatives has no share
    expect(nodeTag(html, 'e4 e5')).toBeDefined();
    expect(html.split('data-node="e5"')[1].split('</li>')[0]).not.toContain('data-share');
  });

  it('renders nested branches when the current path runs through them', () => {
    const html = renderToString(
      <MoveTree lesson={evansGambitDestruction} currentPath={[...ITALIAN, 'Nd4', 'Nxd4', 'exd4', 'c3', 'Bc5']} />
    );
    expect(nodeTag(html, 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 c3 Bc5')).toContain('data-current="true"');
    expect(html).toContain('data-node="cxd4"');
    expect(html).toContain('>6.cxd4<');
    expect(html).toContain('>50%<');
  });

  it('marks the auto-played prefix before startPly', () => {
    const html = renderToString(<MoveTree lesson={scandinavianRefutationDrill} currentPath={['e4', 'd5']} />);
    expect(nodeTag(html, 'e4')).toContain('data-prefix="true"');
    expect(nodeTag(html, 'e4 d5')).toContain('data-prefix="true"');
    expect(nodeTag(html, 'e4 d5')).toContain('data-current="true"');
    expect(nodeTag(html, 'e4 d5 exd5')).not.toContain('data-prefix');
    expect(html).toContain('>2...Qxd5<');
    expect(html).toContain('>67%<');
    expect(html).toContain('>33%<');
  });

  it('numbers moves from the lesson FEN for lessons that do not start at move one', () => {
    const html = renderToString(<MoveTree lesson={queenCageBoxMate} currentPath={[]} />);
    expect(html).toContain('>1.Qf3<');
    expect(html).toContain('>1...Kd6<');
    expect(html).toContain('>2.Qe4<');
  });
});
