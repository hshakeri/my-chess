/**
 * Deep links (DC-5): the URL hash names the tab, and on the Lessons tab the lesson, so a printed
 * sheet's QR code or a shared link opens the app where it points. GitHub Pages serves index.html for
 * /my-chess/, so hash routes need no server fallback.
 *
 *   #/play                    the Play tab; #/play?fen=<FEN>&color=w|b opens a position there
 *   #/database  #/diagnostics  #/worksheets  #/lessons
 *   #/lesson/<lesson id>      a lesson on the Lessons tab
 */

export type View = 'play' | 'database' | 'diagnostics' | 'lessons' | 'worksheets';

export interface Route {
  view: View;
  lessonId?: string;
  fen?: string;
  color?: 'w' | 'b';
}

/** The published app; links printed on paper point here. */
export const APP_URL = 'https://hshakeri.github.io/my-chess/';

const VIEWS: View[] = ['play', 'database', 'diagnostics', 'lessons', 'worksheets'];

export function parseHash(hash: string): Route | null {
  const match = /^#\/([^?]*)(?:\?(.*))?$/.exec(hash.trim());
  if (!match) return null;
  const [path, query = ''] = [match[1], match[2]];
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const params = new URLSearchParams(query);
  if (parts[0] === 'lesson' && parts[1]) return { view: 'lessons', lessonId: parts[1] };
  if (parts.length !== 1 || !VIEWS.includes(parts[0] as View)) return null;
  const route: Route = { view: parts[0] as View };
  if (route.view === 'play') {
    const fen = params.get('fen');
    const color = params.get('color');
    if (fen) route.fen = fen;
    if (color === 'w' || color === 'b') route.color = color;
  }
  return route;
}

export function formatRoute(route: Route): string {
  if (route.view === 'lessons' && route.lessonId) return `#/lesson/${encodeURIComponent(route.lessonId)}`;
  if (route.view === 'play' && route.fen) {
    const params = new URLSearchParams({ fen: route.fen });
    if (route.color) params.set('color', route.color);
    return `#/play?${params.toString()}`;
  }
  return `#/${route.view}`;
}

/** The full link to a lesson, for print. */
export const lessonUrl = (lessonId: string): string => `${APP_URL}${formatRoute({ view: 'lessons', lessonId })}`;
