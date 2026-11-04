/**
 * The lesson book on the Book tab. `npm run book` and `npm run book:pdf` make it when the site is
 * published (`.github/workflows/deploy.yml` copies it to `book/` beside the app); it is never in the
 * repository. These helpers are the parts of the viewer that need no browser and no pdf.js.
 */
import { APP_URL } from '../router';

/** The book beside the running app (the dev server serves `book/` too, once it is built). */
export const BOOK_PDF_URL = `${import.meta.env.BASE_URL}book/lesson-book.pdf`;

/** The published book, for a copy of the app that has none (a dev server before `npm run book:pdf`). */
export const PUBLISHED_BOOK_URL = `${APP_URL}book/lesson-book.pdf`;

/** Every PDF starts with `%PDF-`; a server that answers a missing file with the app's own page does not. */
export function isPdfHeader(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
}

/** No canvas wider than this many pixels: a phone keeps a few pages drawn without running out of memory. */
export const MAX_CANVAS_WIDTH = 2000;

/**
 * The scale to draw a page at: sharp on the screen (its CSS width times the pixel ratio, at most 2,
 * as on a phone), never wider than MAX_CANVAS_WIDTH pixels.
 */
export function renderScale(cssWidth: number, pageWidth: number, devicePixelRatio: number): number {
  if (!(cssWidth > 0) || !(pageWidth > 0)) return 1;
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  return Math.min(cssWidth * ratio, MAX_CANVAS_WIDTH) / pageWidth;
}

/** Reads a response's body whole, telling how far it got (total is 0 when the server sends no length). */
export async function readWithProgress(res: Response, onProgress: (received: number, total: number) => void): Promise<Uint8Array> {
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, total);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** A bookmark of the book: a part (depth 0) or a chapter or sheet inside it (depth 1), and its page. */
export interface BookHeading {
  title: string;
  page: number;
  depth: number;
}

export interface BookPart {
  title: string;
  page: number;
  chapters: Array<{ title: string; page: number }>;
}

/** The bookmarks as the contents menu shows them: each part with the chapters under it, in order. */
export function groupHeadings(headings: BookHeading[]): BookPart[] {
  const parts: BookPart[] = [];
  for (const h of headings) {
    if (h.depth === 0 || parts.length === 0) parts.push({ title: h.title, page: h.page, chapters: [] });
    else parts[parts.length - 1].chapters.push({ title: h.title, page: h.page });
  }
  return parts;
}

/**
 * The page being read: the last page whose top has scrolled above the line just under the toolbar
 * (`tops` are the pages' tops relative to that line, in order). Page 1 until the first page passes it.
 */
export function pageAtLine(tops: number[]): number {
  let page = 1;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= 1) page = i + 1;
    else break;
  }
  return page;
}
