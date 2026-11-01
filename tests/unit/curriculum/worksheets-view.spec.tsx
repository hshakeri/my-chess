import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WorksheetsView } from '../../../src/views/WorksheetsView';
import { allWorksheets } from '../../../src/curriculum/worksheetsData';
import { worksheetAnswerTokens } from '../../../src/curriculum/worksheetLines';

const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The printed sheet before the answer page, as text. */
const sheetText = (html: string) =>
  decode(html.slice(html.indexOf('data-printable="sheet"'), html.indexOf('data-printable="answer-key"')).replace(/<[^>]+>/g, ' '));
const answerText = (html: string) => decode(html.slice(html.indexOf('data-printable="answer-key"')).replace(/<[^>]+>/g, ' '));
const boardSquares = (html: string) =>
  [...html.slice(html.indexOf('data-printable="board"')).matchAll(/data-ws-square="([a-h][1-8])"/g)].slice(0, 64).map((m) => m[1]);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('WorksheetsView: answers stay on the answer page and diagrams match the board', () => {
  it('never prints an answer on the sheet, and the answer page has every solution and the full line', () => {
    for (const ws of allWorksheets) {
      const html = renderToString(<WorksheetsView initialWorksheetId={ws.id} />);
      const sheet = sheetText(html);
      expect(sheet).toContain(ws.title);
      for (const token of worksheetAnswerTokens(ws)) {
        // A whole move only: "d4" is not found inside "cxd4", nor "O-O" inside "O-O-O"
        const found = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(token)}(?![A-Za-z0-9-])`).test(sheet);
        expect(found, `${ws.id}: ${token} appears before the answer page`).toBe(false);
      }
      const answers = answerText(html);
      for (const ak of ws.answerKey) expect(answers).toContain(ak.solutionSan);
      expect(answers).toContain(ws.movesSan.join(' '));
    }
  });

  it('draws a Black sheet from Black\'s side and says who is to move', () => {
    const black = renderToString(<WorksheetsView initialWorksheetId="ws-siberian-trap" />);
    const blackSquares = boardSquares(black);
    expect(blackSquares[0]).toBe('h1');
    expect(blackSquares[63]).toBe('a8');
    expect(sheetText(black)).toContain('Black to move');
    expect(black).toContain('data-ws-square="a1" data-shade="dark"');
    expect(black).toContain('data-ws-square="h1" data-shade="light"');

    const white = renderToString(<WorksheetsView initialWorksheetId="ws-hoot65-scandi-drill" />);
    expect(boardSquares(white)[0]).toBe('a8');
    expect(boardSquares(white)[63]).toBe('h1');
    expect(sheetText(white)).toContain('White to move');
  });

  it('shows the moves to the diagram, a diagram for each exercise with its own position, and a log row', () => {
    const scotch = renderToString(<WorksheetsView initialWorksheetId="ws-scotch-gambit" />);
    const sheet = sheetText(scotch);
    expect(sheet).toContain('1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4 Be7 5.c3 dxc3');
    expect(scotch.match(/data-printable="exercise-board"/g)).toHaveLength(1);
    expect(sheet).toContain('Diagram 2');
    for (const label of ['Date', 'Attempt', 'Score (of 2)', 'Next review']) expect(sheet).toContain(label);

    // The Siberian sheet has one exercise, on Diagram 1 itself
    expect(renderToString(<WorksheetsView initialWorksheetId="ws-siberian-trap" />)).not.toContain('data-printable="exercise-board"');
  });
});

describe('WorksheetsView Component', () => {
  it('renders without crashing and contains required root view attributes', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('worksheets-view');
    expect(html).toContain('data-view="worksheets"');
    expect(html).toContain('Printable Worksheets &amp; Physical-Board Studies');
  });

  it('renders selectable worksheet items covering curriculum lessons and hoot65 drills', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('worksheet-item');
    expect(html).toContain('Scotch');
    expect(html).toContain('Scandinavian');
    expect(html).toContain('Caro-Kann');
    expect(html).toContain('hoot65');
  });

  it('renders printable sheet container with data-printable="sheet"', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('printable-sheet');
    expect(html).toContain('data-printable="sheet"');
  });

  it('renders 2D board diagram with ranks 1-8 and files a-h coordinates', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('print-diagram');
    expect(html).toContain('worksheet-board');
    expect(html).toContain('data-printable="board"');

    // Rank coordinates 1 to 8
    expect(html).toContain('>1<');
    expect(html).toContain('>8<');

    // File coordinates a to h
    expect(html).toContain('>a<');
    expect(html).toContain('>h<');
  });

  it('includes guided exercises with fill-in-the-blank lines and underscores', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('Guided Exercises');
    expect(html).toContain('fill-in-line');
    expect(html).toContain('_____');
  });

  it('includes separated answer key section with CSS break-before page and page-break-always', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('worksheet-answer-key');
    expect(html).toContain('data-printable="answer-key"');
    expect(html).toContain('break-before-page');
    expect(html).toContain('page-break-always');
    expect(html).toContain('Answer Key &amp; Grandmaster Solutions');
  });

  it('provides a print action button calling window.print()', () => {
    const html = renderToString(<WorksheetsView />);

    expect(html).toContain('Print Worksheet');
    expect(html).toContain('no-print');
    expect(html).toContain('print:hidden');
  });
});
