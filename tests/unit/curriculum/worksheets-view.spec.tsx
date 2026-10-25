import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WorksheetsView } from '../../../src/views/WorksheetsView';

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
