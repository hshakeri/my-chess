import React from 'react';
import { type MicroQuestion, pieceOn, sameSquares } from '../services/microQuestions';

export type QuestionStatus = 'asking' | 'right' | 'wrong';
export type QuestionAnswer = string[] | number | boolean;

/** Whether `answer` answers `q`. "4+" stands for four checks or more. */
export function isRight(q: MicroQuestion, answer: QuestionAnswer): boolean {
  if (q.kind === 'checks') return typeof answer === 'number' && (answer >= 4 ? q.answer >= 4 : q.answer === answer);
  if (q.kind === 'safe') return answer === q.answer;
  return Array.isArray(answer) && sameSquares(answer, q.answer);
}

/** Board styles: the picked squares while asking; after the answer, the answer in green and wrong picks in red. */
export function questionSquareStyles(q: MicroQuestion, picked: string[], status: QuestionStatus): Record<string, string> {
  const styles: Record<string, string> = {};
  if (q.kind === 'checks' || q.kind === 'safe') return styles;
  if (status === 'asking') {
    for (const sq of picked) styles[sq] = 'ring-4 ring-inset ring-sky-400';
    return styles;
  }
  for (const sq of q.answer) styles[sq] = 'ring-4 ring-inset ring-emerald-400';
  for (const sq of picked) if (!q.answer.includes(sq)) styles[sq] = 'ring-4 ring-inset ring-rose-500';
  return styles;
}

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The answer in words, shown once the question is answered. */
function explanation(q: MicroQuestion, fen: string): string {
  switch (q.kind) {
    case 'attacks':
      return q.answer.length ? `It attacks ${list(q.answer.map((sq) => pieceOn(fen, sq)))}.` : 'It attacks none of your pieces.';
    case 'undefended':
      return q.answer.length ? `Nothing defends ${list(q.answer.map((sq) => pieceOn(fen, sq)))}.` : 'Every piece has a defender.';
    case 'loose':
      return q.answer.length ? `Your opponent could win ${list(q.answer.map((sq) => pieceOn(fen, sq)))}.` : 'Nothing of yours can be won.';
    case 'knight':
      return `The knight attacks ${list(q.answer)}.`;
    case 'checks':
      return q.answer ? `They would have ${q.answer} check${q.answer === 1 ? '' : 's'}: ${q.checks.join(', ')}.` : 'They would have no check.';
    case 'safe':
      return q.reason;
  }
}

interface BoardQuestionProps {
  question: MicroQuestion;
  /** The position the question is about, for naming pieces in the answer. */
  fen: string;
  picked: string[];
  status: QuestionStatus;
  onSubmit: (answer: QuestionAnswer) => void;
  /** Shown after the answer when set (the warm-up's "Next"). */
  onContinue?: () => void;
}

/**
 * A one-click board question (CL-5): square questions are answered by clicking squares on the board
 * and then Done (or the button for none); a count or a yes/no by a button.
 */
export const BoardQuestion: React.FC<BoardQuestionProps> = ({ question, fen, picked, status, onSubmit, onContinue }) => {
  const button = 'px-2.5 py-1 rounded-md text-xs font-semibold border transition';
  return (
    <div
      data-section="board-question"
      data-question-kind={question.kind}
      data-question-status={status}
      className={`p-3 rounded-xl border text-sm ${
        status === 'asking' ? 'bg-sky-950/40 border-sky-500/40 text-sky-100' : status === 'right' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100' : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
      }`}
    >
      <p className="font-medium">{question.prompt}</p>
      {status === 'asking' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {question.kind === 'checks' &&
            [0, 1, 2, 3, 4].map((n) => (
              <button key={n} type="button" data-answer={n} onClick={() => onSubmit(n)} className={`${button} border-sky-500/50 hover:bg-sky-900/60`}>
                {n === 4 ? '4+' : n}
              </button>
            ))}
          {question.kind === 'safe' && (
            <>
              <button type="button" data-answer="yes" onClick={() => onSubmit(true)} className={`${button} border-sky-500/50 hover:bg-sky-900/60`}>
                Yes, safe
              </button>
              <button type="button" data-answer="no" onClick={() => onSubmit(false)} className={`${button} border-sky-500/50 hover:bg-sky-900/60`}>
                No
              </button>
            </>
          )}
          {question.kind !== 'checks' && question.kind !== 'safe' && (
            <>
              <span className="text-xs text-sky-200/80" data-picked={picked.length}>
                {picked.length ? `Picked: ${[...picked].sort().join(', ')}` : 'Click squares on the board.'}
              </span>
              <button
                type="button"
                data-action="question-done"
                disabled={picked.length === 0}
                onClick={() => onSubmit(picked)}
                className={`${button} border-sky-500/50 hover:bg-sky-900/60 disabled:opacity-40`}
              >
                Done
              </button>
              {question.noneLabel && (
                <button type="button" data-action="question-none" onClick={() => onSubmit([])} className={`${button} border-sky-500/50 hover:bg-sky-900/60`}>
                  {question.noneLabel}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2" data-question-feedback>
          <span>
            <b>{status === 'right' ? 'Right.' : 'Not quite.'}</b> {explanation(question, fen)}
            {status === 'wrong' && question.kind !== 'checks' && question.kind !== 'safe'
              ? question.answer.length
                ? ' Green marks the answer, red your other clicks.'
                : ' Red marks your clicks.'
              : ''}
          </span>
          {onContinue && (
            <button type="button" data-action="question-next" onClick={onContinue} className={`${button} border-current hover:bg-slate-800/60`}>
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
};
