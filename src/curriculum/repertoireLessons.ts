/**
 * Repertoire lines that have an authored interactive lesson. Lines without an entry open a
 * lesson built from the line itself (`lessonFromRepertoireLine`). A line maps to the lesson
 * that contains its moves, directly or by transposition.
 */
export const REPERTOIRE_LINE_TO_LESSON: Record<string, string> = {
  'white-scandi-refutation': 'lesson-scandinavian-refutation-drill',
  'white-italian-evans-gambit': 'lesson-evans-gambit-destruction',
  // The Scotch line has no authored lesson on the plan's own move order: it is built from the line
  'black-caro-kann-advance': 'lesson-black-caro-kann-advance',
  'black-caro-kann-classical': 'lesson-black-caro-kann-classical',
  'black-slav-wall': 'lesson-black-slav-wall',
  'black-wall-vs-london': 'lesson-black-wall-vs-london',
  'black-wall-vs-nf3-bf4': 'lesson-black-wall-vs-london',
  'black-wall-vs-nf3-c4': 'lesson-black-slav-wall',
  'black-wall-vs-english': 'lesson-black-wall-vs-flank',
  'black-wall-vs-reti': 'lesson-black-wall-vs-flank',
};
