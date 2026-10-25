import React, { useState } from 'react';
import {
  Printer,
  FileText,
  BookOpen,
  Award,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Target,
} from 'lucide-react';
import {
  allWorksheets,
  scotchGambitWorksheet,
  hoot65ScandiWorksheet,
} from '../curriculum/worksheetsData';
import { PrintableWorksheetData } from '../types/curriculum';
import { PieceSymbol, PieceColor } from '../types/chess';
import { ChessPiece } from '../components/ChessPiece';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

function parseFenToBoard(fen: string): Array<Array<{ type: PieceSymbol; color: PieceColor } | null>> {
  const [placement] = fen.split(' ');
  const rows = placement.split('/');
  return rows.map((row) => {
    const squares: Array<{ type: PieceSymbol; color: PieceColor } | null> = [];
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          squares.push(null);
        }
      } else {
        const isUpper = char === char.toUpperCase();
        squares.push({
          type: char.toLowerCase() as PieceSymbol,
          color: isUpper ? 'w' : 'b',
        });
      }
    }
    return squares;
  });
}

export const WorksheetsView: React.FC = () => {
  // Default to Scandinavian drill worksheet (or Scotch Gambit)
  const [selectedWorksheet, setSelectedWorksheet] = useState<PrintableWorksheetData>(() => {
    return hoot65ScandiWorksheet || scotchGambitWorksheet || allWorksheets[0];
  });

  const [filterType, setFilterType] = useState<'all' | 'curriculum_lesson' | 'hoot65_drill'>('all');

  const filteredWorksheets = allWorksheets.filter((ws) => {
    if (filterType === 'all') return true;
    return ws.type === filterType;
  });

  const boardMatrix = parseFenToBoard(selectedWorksheet.diagramFen);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="worksheets-view w-full max-w-7xl mx-auto flex flex-col gap-6" data-view="worksheets">
      {/* Interactive Controls Bar (hidden during print) */}
      <div className="no-print print:hidden bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              Physical-Board Practice
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              @media print Optimized
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            Printable Worksheets & Physical-Board Studies
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Select an opening curriculum lesson or a personalized hoot65 weakness drill to generate a clean, print-ready paper worksheet with crisp 2D board diagrams, guided fill-in exercises, and a separate answer key.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="no-print print:hidden px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-700/40 whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          <span>Print Worksheet</span>
        </button>
      </div>

      {/* Main Container: Selector (no-print) + Printable Document */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Worksheet Selector (no-print) */}
        <div className="no-print print:hidden lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              Worksheet Choices
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {filteredWorksheets.length} Available
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`flex-1 py-1 rounded font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Worksheets
            </button>
            <button
              type="button"
              onClick={() => setFilterType('curriculum_lesson')}
              className={`flex-1 py-1 rounded font-medium transition-colors ${
                filterType === 'curriculum_lesson'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Curriculum Lessons
            </button>
            <button
              type="button"
              onClick={() => setFilterType('hoot65_drill')}
              className={`flex-1 py-1 rounded font-medium transition-colors ${
                filterType === 'hoot65_drill'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              hoot65 Drills
            </button>
          </div>

          {/* Worksheet list cards */}
          <div className="flex flex-col gap-2 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
            {filteredWorksheets.map((ws) => {
              const isSelected = ws.id === selectedWorksheet.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorksheet(ws)}
                  className={`worksheet-item text-left rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            ws.type === 'hoot65_drill'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {ws.type === 'hoot65_drill' ? 'hoot65 Weakness Drill' : 'Curriculum Lesson'}
                        </span>
                        {ws.eco && (
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            {ws.eco}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">
                        {ws.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {ws.subtitle}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 mt-1 flex-shrink-0 transition-transform ${
                        isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Source: {ws.sourceBook || 'PDF Archives'}</span>
                    <span>{ws.exercises.length} Exercises</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Printable Paper Sheet Container */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div
            className="printable-sheet bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none w-full"
            data-printable="sheet"
          >
            {/* Sheet Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs uppercase font-bold tracking-widest text-slate-500">
                  {selectedWorksheet.type === 'hoot65_drill'
                    ? 'Personalized hoot65 Weakness Drill & Physical Repertoire'
                    : 'Master Chess Curriculum Study Sheet'}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  ECO {selectedWorksheet.eco || 'OPEN'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                {selectedWorksheet.title}
              </h1>
              <p className="text-sm sm:text-base font-medium text-slate-700 mt-1">
                {selectedWorksheet.subtitle}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 border-t border-slate-200 pt-2">
                <span>
                  <strong>Curriculum Source:</strong> {selectedWorksheet.sourceBook}
                </span>
                <span>
                  <strong>Author:</strong> {selectedWorksheet.author}
                </span>
                <span>
                  <strong>Playing Color:</strong>{' '}
                  <span className="capitalize font-semibold text-slate-800">
                    {selectedWorksheet.targetColor || 'White'}
                  </span>
                </span>
              </div>
            </div>

            {/* Lesson Summary & Thematic Objective */}
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" />
                Lesson Synopsis & Thematic Objective
              </h3>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                {selectedWorksheet.lessonSummary}
              </p>
            </div>

            {/* Main Section: 2D Diagram & Physical Board Steps */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8 items-start">
              {/* High-Contrast 2D Diagram with Ranks 1-8 and Files a-h */}
              <div className="md:col-span-6 flex flex-col items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                  Key Diagram Position
                </h4>

                {/* Diagram Container */}
                <div
                  className="print-diagram worksheet-board bg-white p-2 rounded-lg border-2 border-slate-900 shadow-md print:shadow-none"
                  data-printable="board"
                >
                  {/* Top file coordinates */}
                  <div className="flex pl-4 pr-4 justify-around text-[11px] font-bold text-slate-800 mb-0.5">
                    {FILES.map((f) => (
                      <span key={`top-${f}`} className="w-8 sm:w-9 text-center">
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* 8x8 Board with rank coordinates on left and right */}
                  <div className="flex">
                    {/* Left rank coordinates */}
                    <div className="flex flex-col justify-around pr-1 text-[11px] font-bold text-slate-800">
                      {RANKS.map((r) => (
                        <span key={`left-${r}`} className="h-8 sm:h-9 flex items-center justify-center">
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* 8x8 Squares Grid */}
                    <div className="grid grid-cols-8 grid-rows-8 border-2 border-slate-900 chess-board-print">
                      {RANKS.map((rankStr, rowIdx) => {
                        const rankNum = parseInt(rankStr, 10);
                        return FILES.map((fileStr, colIdx) => {
                          const fileNum = colIdx + 1;
                          const isLight = (fileNum + rankNum) % 2 === 1;
                          const squarePiece = boardMatrix[rowIdx]?.[colIdx];
                          return (
                            <div
                              key={`${fileStr}${rankStr}`}
                              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center relative select-none ${
                                isLight ? 'bg-amber-50' : 'bg-amber-200/90'
                              }`}
                            >
                              {squarePiece && (
                                <div className="w-7 h-7 sm:w-8 sm:h-8">
                                  <ChessPiece
                                    type={squarePiece.type}
                                    color={squarePiece.color}
                                    className="w-full h-full"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>

                    {/* Right rank coordinates */}
                    <div className="flex flex-col justify-around pl-1 text-[11px] font-bold text-slate-800">
                      {RANKS.map((r) => (
                        <span key={`right-${r}`} className="h-8 sm:h-9 flex items-center justify-center">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom file coordinates */}
                  <div className="flex pl-4 pr-4 justify-around text-[11px] font-bold text-slate-800 mt-0.5">
                    {FILES.map((f) => (
                      <span key={`bottom-${f}`} className="w-8 sm:w-9 text-center">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-slate-600 mt-2 text-center">
                  White to Move (ranks 1-2) • Black (ranks 7-8)
                </div>
              </div>

              {/* Physical Board Setup & Exploration Steps */}
              <div className="md:col-span-6 flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    Physical Chessboard Setup Steps
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-800 leading-relaxed">
                    {(selectedWorksheet.physicalBoardSteps || [
                      'Set up your physical board with pieces on their initial squares.',
                      'Play through the opening moves step by step to arrive at the diagram position.',
                      'Study the key threats, candidate moves, and write your answers in the exercises below.',
                    ]).map((step, idx) => (
                      <li key={idx} className="pl-1">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Main line SAN notation */}
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Opening Sequence Notation
                  </h5>
                  <div className="font-mono text-xs text-slate-900 flex flex-wrap gap-x-2 gap-y-1">
                    {selectedWorksheet.movesSan.map((move, i) => (
                      <span key={i} className="font-semibold">
                        {move}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Common Blunder Warning if available */}
                {selectedWorksheet.trapWarning && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs">
                    <div className="font-bold text-red-900 flex items-center gap-1.5 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      Tactical Warning: {selectedWorksheet.trapWarning.name}
                    </div>
                    <div className="text-red-800 leading-relaxed">
                      {selectedWorksheet.trapWarning.explanation}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Guided Exercises Section with Fill-in-the-Blank Lines */}
            <div className="border-t-2 border-slate-900 pt-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-700" />
                  Guided Exercises: Find the Move & Write Calculation
                </h3>
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Do not look at the answer key yet
                </span>
              </div>

              <div className="space-y-6">
                {selectedWorksheet.exercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-300"
                  >
                    <div className="font-bold text-sm text-slate-950 mb-2">
                      {ex.prompt}
                    </div>

                    {/* Fill-in-the-blank lines */}
                    <div className="space-y-3 mt-3">
                      {ex.fillInBlankLines && ex.fillInBlankLines.length > 0 ? (
                        ex.fillInBlankLines.map((line, lineIdx) => (
                          <div
                            key={lineIdx}
                            className="fill-in-line font-mono text-xs sm:text-sm text-slate-700 py-1 border-b border-dashed border-slate-400"
                          >
                            {line}
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="fill-in-line font-mono text-xs sm:text-sm text-slate-700 py-1 border-b border-dashed border-slate-400">
                            My Move: _______________________
                          </div>
                          <div className="fill-in-line font-mono text-xs sm:text-sm text-slate-700 py-1 border-b border-dashed border-slate-400">
                            Tactical Calculation / Refutation: _______________________
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Answer Key Section (Forced Page Break in CSS for clean printing) */}
            <div
              className="worksheet-answer-key break-before-page page-break-always mt-10 pt-8 border-t-4 border-slate-900 print:mt-0 print:pt-6"
              data-printable="answer-key"
              style={{ breakBefore: 'page', pageBreakBefore: 'always' }}
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-slate-800">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-emerald-700" />
                  <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">
                    Answer Key & Grandmaster Solutions
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-200 text-slate-800">
                  Separate Page
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Compare your physical board moves with the certified solutions below. Review the rationale and execute the full follow-up sequences on your physical board.
              </p>

              <div className="space-y-5">
                {selectedWorksheet.answerKey.map((ans, aIdx) => (
                  <div
                    key={aIdx}
                    className="p-4 rounded-xl bg-slate-100 border border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Exercise {ans.exerciseIndex} Solution
                      </span>
                      <span className="font-mono font-extrabold text-base px-2.5 py-0.5 rounded bg-emerald-600 text-white shadow-sm">
                        {ans.solutionSan}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium mt-1">
                      {ans.rationale}
                    </p>

                    {ans.fullSequence && ans.fullSequence.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-600">Full Follow-up Sequence:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {ans.fullSequence.join(' ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer certification */}
              <div className="mt-8 pt-4 border-t border-slate-300 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  My Chess Coach • Distilled from classical chess literature & Chess.com archives
                </span>
                <span>Page 2 / Answer Key</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
