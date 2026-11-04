import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BookOpen, Download, ExternalLink, Loader2 } from 'lucide-react';
import type { PDFDocumentProxy } from '../services/pdfBook';
import {
  BOOK_PDF_URL,
  PUBLISHED_BOOK_URL,
  groupHeadings,
  isPdfHeader,
  pageAtLine,
  readWithProgress,
  renderScale,
  type BookHeading,
} from '../services/bookFile';

/**
 * The Book tab: the whole printable lesson book, every page, in the app (pdf.js draws each page on a
 * canvas, so it shows on a phone as well, where a PDF in a frame shows one page or none). A page is
 * drawn when it comes within a few screens and let go when it is far away, so 96 pages never sit in
 * memory at once. The PDF itself is a download away for printing.
 */

type Status =
  | { kind: 'loading'; received: number; total: number }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

interface Book {
  doc: PDFDocumentProxy;
  sizes: Array<{ width: number; height: number }>;
  headings: BookHeading[];
}

/** How far beyond the screen a page is drawn ahead of the reader. */
const DRAW_MARGIN = '1500px 0px';

const PdfPage = memo(function PdfPage({
  doc,
  pageNumber,
  total,
  size,
  register,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  total: number;
  size: { width: number; height: number };
  register: (pageNumber: number, el: HTMLDivElement | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [near, setNear] = useState(false);
  const [width, setWidth] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);

  const setBox = useCallback(
    (el: HTMLDivElement | null) => {
      boxRef.current = el;
      register(pageNumber, el);
    },
    [register, pageNumber],
  );

  // Is the page within a few screens of the reader?
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: DRAW_MARGIN });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Its width on the screen: a new width (a turned phone, a resized window) draws it again
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || !canvas || width === 0) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: renderScale(width, size.width, window.devicePixelRatio) });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) {
        setDrawn(true);
        setFailed(false);
      }
    })().catch(() => {
      // A cancelled draw (the page scrolled away, the tab closed) is not a failure
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      task?.cancel();
      // Let the pixels go: a phone holds only a few drawn pages
      canvas.width = 0;
      canvas.height = 0;
      setDrawn(false);
    };
  }, [near, width, doc, pageNumber, size.width]);

  return (
    <figure className="w-full max-w-[900px] mx-auto" data-book-page={pageNumber} data-drawn={drawn ? 'true' : 'false'}>
      <div
        ref={setBox}
        className="relative w-full bg-white rounded shadow-lg shadow-black/40 overflow-hidden"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-label={`Page ${pageNumber} of ${total}`} role="img" />
        {!drawn && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {failed ? `Page ${pageNumber} could not be drawn` : `Page ${pageNumber}`}
          </div>
        )}
      </div>
      <figcaption className="text-center text-[11px] text-slate-500 mt-1.5">
        Page {pageNumber} of {total}
      </figcaption>
    </figure>
  );
});

export const BookView: React.FC = () => {
  const [status, setStatus] = useState<Status>({ kind: 'loading', received: 0, total: 0 });
  const [book, setBook] = useState<Book | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDraft, setPageDraft] = useState('1');
  const [editingPage, setEditingPage] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    (async () => {
      // Revalidate, so a newly published book shows at once
      const res = await fetch(BOOK_PDF_URL, { cache: 'no-cache' });
      if (!res.ok) {
        if (!cancelled) setStatus({ kind: 'missing' });
        return;
      }
      const bytes = await readWithProgress(res, (received, total) => {
        if (!cancelled) setStatus({ kind: 'loading', received, total });
      });
      if (cancelled) return;
      // A dev server answers a book it does not have with the app's own page
      if (!isPdfHeader(bytes)) {
        setStatus({ kind: 'missing' });
        return;
      }
      const pdf = await import('../services/pdfBook');
      const doc = await pdf.openPdf(bytes);
      opened = doc;
      if (cancelled) {
        void doc.loadingTask.destroy();
        return;
      }
      const [sizes, headings] = await Promise.all([pdf.pageSizes(doc), pdf.bookHeadings(doc).catch(() => [])]);
      if (cancelled) return;
      setBook({ doc, sizes, headings });
      setStatus({ kind: 'ready' });
    })().catch((err: unknown) => {
      if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    });
    return () => {
      cancelled = true;
      void opened?.loadingTask.destroy();
    };
  }, []);

  // The toolbar stays under the app's own (sticky) header
  useEffect(() => {
    const header = document.querySelector('.app-navbar');
    const measure = () => setStickyTop(header ? Math.round(header.getBoundingClientRect().height) : 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const register = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) pageEls.current.set(pageNumber, el);
    else pageEls.current.delete(pageNumber);
  }, []);

  /** The line just under the toolbar once it sticks under the header, in the window's coordinates. */
  const readingLine = useCallback(() => stickyTop + (toolbarRef.current?.offsetHeight ?? 0) + 8, [stickyTop]);

  // Follow the page being read
  useEffect(() => {
    if (!book) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // Scrolled to the end: the last page, though its top cannot reach the line
        const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        const line = readingLine();
        const tops = book.sizes.map((_, i) => (pageEls.current.get(i + 1)?.getBoundingClientRect().top ?? Infinity) - line);
        setCurrentPage(atEnd ? book.sizes.length : pageAtLine(tops));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [book, readingLine]);

  useEffect(() => {
    if (!editingPage) setPageDraft(String(currentPage));
  }, [currentPage, editingPage]);

  const goToPage = useCallback(
    (page: number) => {
      if (!book) return;
      const target = Math.min(Math.max(Math.round(page), 1), book.sizes.length);
      const el = pageEls.current.get(target);
      if (!el) return;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - readingLine() + 1 });
      setCurrentPage(target);
    },
    [book, readingLine],
  );

  const parts = useMemo(() => groupHeadings(book?.headings ?? []), [book]);
  const total = book?.sizes.length ?? 0;

  const links = (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href={BOOK_PDF_URL}
        download="lesson-book.pdf"
        data-book-download
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        <Download className="w-3.5 h-3.5" /> Download PDF
      </a>
      <a
        href={BOOK_PDF_URL}
        target="_blank"
        rel="noopener"
        data-book-open
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Open to print
      </a>
    </div>
  );

  return (
    <div className="flex flex-col gap-3" data-view="book">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="text-base font-bold text-white">Lesson Book</h2>
          {status.kind === 'ready' && (
            <span data-book-pages className="text-xs text-slate-400 whitespace-nowrap">
              {total} pages
            </span>
          )}
        </div>
        {links}
      </div>

      {/* One row that stays under the header while the pages scroll: the chapters and the page */}
      {status.kind === 'ready' && (
        <div
          ref={toolbarRef}
          data-book-toolbar
          className="sticky z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-950/95 backdrop-blur border-b border-slate-800 flex items-center gap-2"
          style={{ top: stickyTop }}
        >
          {parts.length > 0 && (
            <select
              aria-label="Go to a chapter"
              data-book-contents
              value=""
              onChange={(e) => {
                if (e.target.value) goToPage(Number(e.target.value));
              }}
              className="flex-1 min-w-0 max-w-md bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5"
            >
              <option value="">Contents…</option>
              {parts.map((part, k) => (
                <optgroup key={`${part.title}-${k}`} label={part.title}>
                  <option value={part.page}>{part.title}</option>
                  {part.chapters.map((chapter, j) => (
                    <option key={`${chapter.title}-${j}`} value={chapter.page}>
                      {chapter.title} · p. {chapter.page}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          <form
            className="flex items-center gap-1.5 shrink-0 ml-auto text-xs text-slate-400"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(pageDraft);
              if (Number.isFinite(n)) goToPage(n);
              (document.activeElement as HTMLElement | null)?.blur();
            }}
          >
            <label htmlFor="book-page">Page</label>
            <input
              id="book-page"
              data-book-page-input
              type="number"
              inputMode="numeric"
              min={1}
              max={total}
              value={pageDraft}
              onFocus={() => setEditingPage(true)}
              onBlur={() => setEditingPage(false)}
              onChange={(e) => setPageDraft(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5 text-center"
            />
            <span className="whitespace-nowrap">of {total}</span>
          </form>
        </div>
      )}

      {status.kind === 'loading' && (
        <div data-book-loading className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading the lesson book
          {status.total > 0 ? ` (${Math.min(100, Math.round((100 * status.received) / status.total))}%)` : status.received > 0 ? ` (${(status.received / 1e6).toFixed(1)} MB)` : ''}
        </div>
      )}

      {status.kind === 'missing' && (
        <div data-book-missing className="max-w-2xl mx-auto mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300 space-y-3">
          <p className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
            <span>This copy of the app has no lesson book. The book is made when the site is published, so it is here on the published site.</span>
          </p>
          <p>
            The published book:{' '}
            <a href={PUBLISHED_BOOK_URL} className="text-emerald-400 underline break-all">
              {PUBLISHED_BOOK_URL}
            </a>
          </p>
          <p>To see it here on a dev server, build it first:</p>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 overflow-x-auto">npm run book && npm run book:pdf</pre>
        </div>
      )}

      {status.kind === 'error' && (
        <div data-book-error className="max-w-2xl mx-auto mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-slate-300 space-y-3">
          <p className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
            <span>The book could not be shown here ({status.message}). The PDF itself can still be downloaded or opened.</span>
          </p>
          {links}
        </div>
      )}

      {status.kind === 'ready' && book && (
        <div className="flex flex-col gap-6 pb-8" data-book-pages-list>
          {book.sizes.map((size, i) => (
            <PdfPage key={i + 1} doc={book.doc} pageNumber={i + 1} total={total} size={size} register={register} />
          ))}
        </div>
      )}
    </div>
  );
};
