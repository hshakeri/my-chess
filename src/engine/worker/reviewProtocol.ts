import type { ReviewInput } from '../../analytics/review';
import type { GameReview } from '../../types/review';

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

export interface ReviewResultMessage {
  type: 'review-result';
  id: string;
  review?: GameReview;
  cancelled?: boolean;
  error?: string;
}
