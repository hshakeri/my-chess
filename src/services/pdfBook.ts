/**
 * The Book tab's PDF reader: pdf.js, in its legacy build so that older iPhone Safari versions can run
 * it too. The Book tab imports this module only when it opens, so pdf.js and its worker (a file of
 * its own beside the app's assets) never load with the rest of the app.
 */
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { BookHeading } from './bookFile';

GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

export function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({ data }).promise;
}

/** Every page's size in PDF points, so each page keeps its place before it is drawn. */
export async function pageSizes(doc: PDFDocumentProxy): Promise<Array<{ width: number; height: number }>> {
  const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)));
  return pages.map((page) => {
    const { width, height } = page.getViewport({ scale: 1 });
    return { width, height };
  });
}

type OutlineItem = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number];

/** The book's bookmarks to `maxDepth` (0 is the parts), each with the page it points to. */
export async function bookHeadings(doc: PDFDocumentProxy, maxDepth = 1): Promise<BookHeading[]> {
  const headings: BookHeading[] = [];
  const walk = async (items: OutlineItem[] | null | undefined, depth: number): Promise<void> => {
    for (const item of items ?? []) {
      const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
      // A destination names its page by reference, or (less often) by its index
      const ref: unknown = Array.isArray(dest) ? dest[0] : null;
      const index = typeof ref === 'number' ? ref : ref && typeof ref === 'object' ? await doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]) : -1;
      if (index >= 0) headings.push({ title: item.title, page: index + 1, depth });
      if (depth < maxDepth) await walk(item.items, depth + 1);
    }
  };
  await walk(await doc.getOutline(), 0);
  return headings;
}
