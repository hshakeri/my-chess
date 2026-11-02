import type { ReviewInput } from '../../analytics/review';
import type { GameReview } from '../../types/review';
import type { MoveSafety } from '../../services/microQuestions';

/** Messages between the page and the engine worker for a post-game review (CL-3). */
export interface ReviewRequestMessage {
  type: 'review';
  id: string;
  input: ReviewInput;
}

export interface CancelMessage {
  type: 'cancel';
  id: string;
}

export type ReviewStage = 'loading' | 'scoring' | 'classifying';

export interface ReviewProgressMessage {
  type: 'review-progress';
  id: string;
  stage: ReviewStage;
  done: number;
  total: number;
}

/** Whether the student's move in a game is safe (the Play tab's safety check), worked out here off the page. */
export interface SafetyRequestMessage {
  type: 'safety';
  id: string;
  fen: string;
  san: string;
  /** The search's node budget; past it the answer is null. */
  maxNodes: number;
}

export interface SafetyResultMessage {
  type: 'safety-result';
  id: string;
  verdict: MoveSafety | null;
}

export interface ReviewResultMessage {
  type: 'review-result';
  id: string;
  review?: GameReview;
  cancelled?: boolean;
  error?: string;
}
