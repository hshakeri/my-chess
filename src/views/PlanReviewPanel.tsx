import React, { useMemo, useState } from 'react';
import { Chessboard } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';
import { allCurriculumLessons } from '../curriculum';
import { plyLabel } from '../curriculum/builder';
import { dueIdeas, gradeIdea, ideaPosition, type IdeaGrade } from '../services/ideaCards';
import type { CurriculumLesson } from '../types/curriculum';

/** The main line as text: "1.e4 c6 2.d4 d5 3.e5 Bf5". */
function lineText(lesson: CurriculumLesson): string {
  return lesson.moves.map((m, i) => plyLabel(lesson.initialFen, i, m.san)).join(' ').replace(/ (\d+)\.\.\./g, ' ');
}

const GRADES: Array<{ grade: IdeaGrade; label: string; tone: string }> = [
  { grade: 'again', label: 'Forgot', tone: 'bg-rose-700 hover:bg-rose-600' },
  { grade: 'hard', label: 'Hard', tone: 'bg-amber-700 hover:bg-amber-600' },
  { grade: 'good', label: 'Good', tone: 'bg-emerald-700 hover:bg-emerald-600' },
  { grade: 'easy', label: 'Easy', tone: 'bg-sky-700 hover:bg-sky-600' },
];

/**
 * Plan review (CL-7 idea cards): the position each opening lesson's main line reaches, the question
 * "what is the plan?", the lesson's objective on demand, and the student's own grade of the recall.
 */
export const PlanReviewPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [queue, setQueue] = useState<CurriculumLesson[]>(() => dueIdeas(allCurriculumLessons));
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const lesson = queue[0];
  const board = useMemo(() => (lesson ? new RulesEngine(ideaPosition(lesson)) : null), [lesson]);
  const side = lesson?.targetColor === 'black' ? 'Black' : 'White';

  const grade = (g: IdeaGrade) => {
    if (!lesson) return;
    gradeIdea(lesson.id, g);
    setQueue((q) => q.slice(1));
    setShown(false);
    setDone((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="plans" data-plans-left={queue.length}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Plan review</h2>
            <p className="text-xs text-slate-400">The plans of your openings, not the moves: say the plan out loud, then check it and grade yourself honestly.</p>
          </div>
          <button type="button" data-action="plans-close" onClick={onClose} className="text-slate-400 hover:text-white text-sm underline">
            Close
          </button>
        </div>

        {!lesson || !board ? (
          <p className="text-sm text-slate-300" data-section="plans-done">
            {done ? `${done} plan${done === 1 ? '' : 's'} reviewed. ` : ''}No plan is due now; the next ones come back on their own schedule.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 items-start" data-plan-lesson={lesson.id}>
            <Chessboard board={board.getBoard()} position={board.getPosition()} orientation={side === 'Black' ? 'b' : 'w'} interactive={false} />
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <div className="font-bold text-white">{lesson.title}</div>
                <div className="text-xs text-slate-400">You play {side}</div>
              </div>
              <p className="font-mono text-xs text-slate-400">{lineText(lesson)}</p>
              <p className="text-white">This is where the line goes. What is your plan, and what are you watching for?</p>
              {!shown ? (
                <button type="button" data-action="plans-show" onClick={() => setShown(true)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
                  Show the plan
                </button>
              ) : (
                <div className="space-y-3" data-section="plan-answer">
                  <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">{lesson.thematicObjective}</p>
                  {lesson.keyTacticalMotif && <p className="text-xs text-slate-400">Motifs: {lesson.keyTacticalMotif}</p>}
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map((g) => (
                      <button key={g.grade} type="button" data-grade={g.grade} onClick={() => grade(g.grade)} className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold ${g.tone}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">{queue.length} due</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
