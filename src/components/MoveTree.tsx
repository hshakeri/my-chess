import React, { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { CurriculumLesson, CurriculumMove } from '../types/curriculum';
import { plyLabel, replyOptions } from '../curriculum/builder';

export interface MoveTreeProps {
  lesson: CurriculumLesson;
  /** SAN path from the lesson's `initialFen` to the position on the board. */
  currentPath: string[];
  /** Called with the SAN path (inclusive) of the node the student clicked. */
  onSelectPath?: (path: string[]) => void;
  className?: string;
}

const pathKey = (path: string[]): string => path.join(' ');
const samePath = (a: string[], b: string[]): boolean => a.length === b.length && a.every((san, i) => san === b[i]);
const startsWith = (path: string[], prefix: string[]): boolean =>
  prefix.length <= path.length && prefix.every((san, i) => san === path[i]);

const Share: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  return (
    <span data-share={pct} className="ml-1 text-[10px] font-mono text-slate-400 tabular-nums" title="Share of replies">
      {`${pct}%`}
    </span>
  );
};

/**
 * Presentational tree of a lesson's main line and its opponent branches.
 * The main line is one list; an opponent move with alternatives carries a nested
 * `data-branches` list where each branch can be collapsed. A branch is expanded by
 * default when the current path runs through it.
 */
export const MoveTree: React.FC<MoveTreeProps> = ({ lesson, currentPath, onSelectPath, className = '' }) => {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const startPly = lesson.startPly ?? 0;

  const isExpanded = (branchPath: string[]): boolean =>
    toggled[pathKey(branchPath)] ?? startsWith(currentPath, branchPath);
  const toggle = (branchPath: string[]) => {
    const key = pathKey(branchPath);
    const next = !isExpanded(branchPath);
    setToggled((prev) => ({ ...prev, [key]: next }));
  };

  const nodeButtonClass = (current: boolean, user: boolean, prefix: boolean) =>
    `px-1.5 py-0.5 rounded font-mono text-xs transition-colors ${
      current
        ? 'bg-emerald-600 text-white font-semibold'
        : prefix
          ? 'text-slate-500 hover:bg-slate-700/50'
          : user
            ? 'text-slate-100 hover:bg-slate-700'
            : 'text-slate-300 hover:bg-slate-700'
    }`;

  const renderSequence = (moves: CurriculumMove[], prefix: string[], root: boolean): React.ReactNode => (
    <ul
      {...(root ? { 'data-tree': 'lesson' } : { 'data-sequence': 'branch' })}
      className={root ? 'space-y-0.5' : 'ml-3 mt-0.5 border-l border-slate-700 pl-2 space-y-0.5'}
    >
      {moves.map((move, i) => {
        const before = [...prefix, ...moves.slice(0, i).map((m) => m.san)];
        const path = [...before, move.san];
        const current = samePath(path, currentPath);
        const isPrefix = root && i < startPly;
        const options = move.alternatives ? replyOptions(move) : null;
        return (
          <li
            key={pathKey(path)}
            data-node={move.san}
            data-path={pathKey(path)}
            data-role={move.isUserMove ? 'user' : 'opponent'}
            data-current={current ? 'true' : undefined}
            data-prefix={isPrefix ? 'true' : undefined}
          >
            <button
              type="button"
              data-action="select-node"
              onClick={() => onSelectPath?.(path)}
              className={nodeButtonClass(current, move.isUserMove, isPrefix)}
            >
              {plyLabel(lesson.initialFen, before.length, move.san)}
            </button>
            {options && <Share value={options[0].share} />}
            {options && (
              <ul data-branches="true" className="ml-3 mt-0.5 space-y-0.5">
                {options.slice(1).map((opt) => {
                  const altPath = [...before, opt.san];
                  const open = isExpanded(altPath);
                  const altCurrent = samePath(altPath, currentPath);
                  return (
                    <li
                      key={pathKey(altPath)}
                      data-node={opt.san}
                      data-path={pathKey(altPath)}
                      data-role="opponent"
                      data-branch="true"
                      data-expanded={open ? 'true' : 'false'}
                      data-current={altCurrent ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        data-action="toggle-branch"
                        aria-expanded={open}
                        aria-label={open ? 'Collapse branch' : 'Expand branch'}
                        onClick={() => toggle(altPath)}
                        className="w-4 text-[10px] text-slate-500 hover:text-slate-200"
                      >
                        {open ? '▾' : '▸'}
                      </button>
                      <button
                        type="button"
                        data-action="select-node"
                        onClick={() => onSelectPath?.(altPath)}
                        className={nodeButtonClass(altCurrent, false, false)}
                      >
                        {plyLabel(lesson.initialFen, before.length, opt.san)}
                      </button>
                      <Share value={opt.share} />
                      {open && opt.continuation && renderSequence(opt.continuation, altPath, false)}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      data-tree-root="lesson"
      className={`move-tree-panel flex flex-col bg-slate-800/90 border border-slate-700 rounded-lg overflow-hidden shadow-lg ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-slate-300">
        <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
        <span>Lesson tree</span>
      </div>
      <div className="p-2 overflow-y-auto max-h-[360px] custom-scrollbar">{renderSequence(lesson.moves, [], true)}</div>
    </div>
  );
};
