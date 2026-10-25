import React from 'react';
import { HumanElo } from '../types/engine';
import { Bot, Cpu, Zap, Activity, Brain } from 'lucide-react';

export interface EngineControlsProps {
  elo: HumanElo;
  onChangeElo: (elo: HumanElo) => void;
  engineColor: 'w' | 'b' | 'none';
  onChangeEngineColor: (color: 'w' | 'b' | 'none') => void;
  isThinking: boolean;
  tierUsed?: 'human_opening_book' | 'maia_neural' | 'heuristic_fallback';
  centipawns?: number;
  modelLoaded: boolean;
  onRequestEngineMove?: () => void;
  canRequestEngineMove?: boolean;
  className?: string;
}

const ELO_OPTIONS: Array<{ value: HumanElo; label: string; desc: string }> = [
  { value: 1100, label: '1100 Elo', desc: 'Casual Club' },
  { value: 1300, label: '1300 Elo', desc: 'Intermediate' },
  { value: 1500, label: '1500 Elo', desc: 'Advanced Club' },
  { value: 1700, label: '1700 Elo', desc: 'Expert' },
  { value: 1900, label: '1900 Elo', desc: 'Candidate Master' },
];

export const EngineControls: React.FC<EngineControlsProps> = ({
  elo,
  onChangeElo,
  engineColor,
  onChangeEngineColor,
  isThinking,
  tierUsed,
  centipawns,
  modelLoaded,
  onRequestEngineMove,
  canRequestEngineMove = false,
  className = '',
}) => {
  // Format centipawns into standard +1.5 / -2.3 format
  const formattedEval =
    centipawns !== undefined
      ? `${centipawns >= 0 ? '+' : ''}${(centipawns / 100).toFixed(1)}`
      : null;

  return (
    <div
      className={`engine-controls-panel bg-slate-800/90 border border-slate-700 rounded-lg p-3 text-slate-200 shadow-lg ${className}`}
    >
      {/* Header with Maia branding & status */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700 mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            Maia Human Engine
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              modelLoaded ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-[11px] text-slate-400">
            {modelLoaded ? 'Maia Neural ONNX' : 'Opening Book + Heuristic'}
          </span>
        </div>
      </div>

      {/* Opponent & Color selection */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Engine Plays
          </label>
          <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700">
            <button
              type="button"
              data-engine-color="b"
              onClick={() => onChangeEngineColor('b')}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                engineColor === 'b'
                  ? 'bg-slate-700 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Black
            </button>
            <button
              type="button"
              data-engine-color="w"
              onClick={() => onChangeEngineColor('w')}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                engineColor === 'w'
                  ? 'bg-slate-700 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              White
            </button>
            <button
              type="button"
              data-engine-color="none"
              onClick={() => onChangeEngineColor('none')}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                engineColor === 'none'
                  ? 'bg-slate-700 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Off
            </button>
          </div>
        </div>

        {/* Human Elo rating tier selector */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Human Rating Tier
          </label>
          <select
            data-select="elo"
            value={elo}
            onChange={(e) => onChangeElo(Number(e.target.value) as HumanElo)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            {ELO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Engine Status / Thinking Banner */}
      <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-700/60 text-xs mb-2">
        <div className="flex items-center gap-2">
          {isThinking ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-emerald-300 font-medium">Predicting human move...</span>
            </>
          ) : (
            <>
              <Bot className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300">
                {engineColor === 'none'
                  ? 'Two-player / Free analysis mode'
                  : `Waiting for ${engineColor === 'w' ? 'Black' : 'White'} move`}
              </span>
            </>
          )}
        </div>

        {formattedEval && (
          <div className="flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
            <Activity className="w-3 h-3" />
            <span>{formattedEval}</span>
          </div>
        )}
      </div>

      {/* Active Tier badge & Force move button */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1 text-slate-400">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>
            {tierUsed === 'human_opening_book' && 'Tier 1: Human Opening Book'}
            {tierUsed === 'maia_neural' && 'Tier 2: Maia Neural Prediction'}
            {tierUsed === 'heuristic_fallback' && 'Tier 3: Heuristic Engine'}
            {!tierUsed && 'Tier: Ready'}
          </span>
        </div>

        {onRequestEngineMove && (
          <button
            type="button"
            data-action="engine-move-now"
            disabled={!canRequestEngineMove || isThinking}
            onClick={onRequestEngineMove}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/70 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors"
          >
            <Cpu className="w-3 h-3" />
            <span>Move Now</span>
          </button>
        )}
      </div>
    </div>
  );
};
