import { describe, it, expect } from 'vitest';
import {
  BOOK_PDF_URL,
  MAX_CANVAS_WIDTH,
  PUBLISHED_BOOK_URL,
  groupHeadings,
  isPdfHeader,
  pageAtLine,
  readWithProgress,
  renderScale,
} from '../../../src/services/bookFile';
import { APP_URL } from '../../../src/router';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('The Book tab: finding the PDF and drawing its pages', () => {
  it('points at the book beside the app, and at the published one', () => {
    expect(BOOK_PDF_URL.endsWith('book/lesson-book.pdf')).toBe(true);
    expect(PUBLISHED_BOOK_URL).toBe(`${APP_URL}book/lesson-book.pdf`);
  });

  it('tells a PDF from the page a server sends for a file it does not have', () => {
    expect(isPdfHeader(bytes('%PDF-1.7\n%âãÏÓ'))).toBe(true);
    expect(isPdfHeader(bytes('<!doctype html><html>'))).toBe(false);
    expect(isPdfHeader(bytes('%PDF'))).toBe(false);
    expect(isPdfHeader(new Uint8Array())).toBe(false);
  });

  it('draws a page as sharp as the screen, at most twice its CSS width and never wider than the cap', () => {
    const letter = 612; // US Letter, in PDF points
    // An iPhone (pixel ratio 3) is drawn at twice its width, not three times
    expect(renderScale(375, letter, 3) * letter).toBeCloseTo(750);
    expect(renderScale(900, letter, 2) * letter).toBeCloseTo(1800);
    expect(renderScale(900, letter, 1) * letter).toBeCloseTo(900);
    // A wide window is capped, and a ratio below 1 counts as 1
    expect(renderScale(1400, letter, 2) * letter).toBeCloseTo(MAX_CANVAS_WIDTH);
    expect(renderScale(500, letter, 0.5) * letter).toBeCloseTo(500);
    // Before the page has a width there is nothing to scale
    expect(renderScale(0, letter, 2)).toBe(1);
    expect(renderScale(375, 0, 2)).toBe(1);
  });

  it('reads the whole file and tells how far it got', async () => {
    const chunks = [bytes('%PDF-'), bytes('1.7 body'), bytes(' %%EOF')];
    const stream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    const length = chunks.reduce((n, c) => n + c.length, 0);

    const progress: Array<[number, number]> = [];
    const read = await readWithProgress(new Response(stream(), { headers: { 'content-length': String(length) } }), (r, t) => progress.push([r, t]));
    expect(new TextDecoder().decode(read)).toBe('%PDF-1.7 body %%EOF');
    expect(progress).toEqual([
      [5, length],
      [13, length],
      [length, length],
    ]);

    // No length from the server: the total is 0 and the bytes still all arrive
    const unsized: number[] = [];
    const again = await readWithProgress(new Response(stream()), (_r, t) => unsized.push(t));
    expect(again.length).toBe(length);
    expect(unsized.every((t) => t === 0)).toBe(true);
  });

  it('groups the bookmarks into parts with their chapters, in order', () => {
    const parts = groupHeadings([
      { title: 'The hoot65 Opening Book', page: 1, depth: 0 },
      { title: 'Contents', page: 1, depth: 1 },
      { title: 'How to use this book', page: 2, depth: 1 },
      { title: 'Part I · Your drills and repertoire lessons', page: 3, depth: 0 },
      { title: '1. What does the last move attack?', page: 3, depth: 1 },
      { title: 'Answers · 1. What does the last move attack?', page: 4, depth: 1 },
      { title: 'Part IV · Practice sheets', page: 55, depth: 0 },
    ]);
    expect(parts.map((p) => [p.title, p.page, p.chapters.length])).toEqual([
      ['The hoot65 Opening Book', 1, 2],
      ['Part I · Your drills and repertoire lessons', 3, 2],
      ['Part IV · Practice sheets', 55, 0],
    ]);
    expect(parts[1].chapters[1]).toEqual({ title: 'Answers · 1. What does the last move attack?', page: 4 });
    // A chapter before any part still gets a place
    expect(groupHeadings([{ title: 'Loose', page: 7, depth: 1 }])).toEqual([{ title: 'Loose', page: 7, chapters: [] }]);
    expect(groupHeadings([])).toEqual([]);
  });

  it('names the page being read: the last one whose top has passed the line under the toolbar', () => {
    expect(pageAtLine([40, 1100, 2200])).toBe(1);
    expect(pageAtLine([-1100, -3, 1050])).toBe(2);
    // A page just reaching the line (within a pixel, after a jump) counts as reached
    expect(pageAtLine([-2200, -1100, 1])).toBe(3);
    expect(pageAtLine([])).toBe(1);
  });
});
