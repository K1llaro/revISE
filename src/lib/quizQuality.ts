import type { QuizQuestion } from '../types/ise';

type ExpectedQuestionCounts = Partial<Record<QuizQuestion['type'], number>>;

export const getQuestionTypeCountMismatch = (
  questions: readonly { type?: unknown }[],
  expectedCounts: ExpectedQuestionCounts
): string | null => {
  const actualCounts: Record<QuizQuestion['type'], number> = { multiple: 0, single: 0, text: 0 };
  let invalidTypeCount = 0;

  for (const question of questions) {
    if (question.type === 'multiple' || question.type === 'single' || question.type === 'text') {
      actualCounts[question.type] += 1;
    } else {
      invalidTypeCount += 1;
    }
  }

  const mismatchedTypes = (['multiple', 'text', 'single'] as const)
    .filter((type) => actualCounts[type] !== (expectedCounts[type] || 0))
    .map((type) => `${type}: expected ${expectedCounts[type] || 0}, got ${actualCounts[type]}`);
  if (invalidTypeCount > 0) mismatchedTypes.push(`invalid/missing type: ${invalidTypeCount}`);
  return mismatchedTypes.length ? mismatchedTypes.join('; ') : null;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export const getChoiceLengthBiasWarning = (questions: readonly QuizQuestion[]): string | null => {
  const choiceQuestions = questions.filter((question) =>
    question.type === 'single' || question.type === 'multiple'
  );
  const moderateLengthCues: number[] = [];

  for (let index = 0; index < choiceQuestions.length; index += 1) {
    const question = choiceQuestions[index];
    const options = question.options || [];
    const correctAnswers = new Set(question.correctAnswers.map((answer) => answer.trim().toLocaleLowerCase()));
    const correctLengths = options
      .filter((option) => correctAnswers.has(option.trim().toLocaleLowerCase()))
      .map((option) => option.trim().replace(/\s+/g, ' ').length);
    const incorrectLengths = options
      .filter((option) => !correctAnswers.has(option.trim().toLocaleLowerCase()))
      .map((option) => option.trim().replace(/\s+/g, ' ').length);
    if (correctLengths.length === 0 || incorrectLengths.length < 2) continue;

    const longestCorrect = Math.max(...correctLengths);
    const longestIncorrect = Math.max(...incorrectLengths);
    const typicalIncorrect = median(incorrectLengths);
    const margin = longestCorrect - typicalIncorrect;
    if (longestCorrect > longestIncorrect && margin >= Math.max(8, typicalIncorrect * 0.25)) {
      return `Question ${index + 1} has a correct answer that stands out by length. Please regenerate the quiz.`;
    }
    if (longestCorrect > longestIncorrect && longestCorrect - longestIncorrect >= 3) {
      moderateLengthCues.push(index);
    }
  }

  if (choiceQuestions.length >= 10 && moderateLengthCues.length >= Math.ceil(choiceQuestions.length * 0.4)) {
    return 'Too many correct answers are longer than their distractors, creating a guessable pattern. Please regenerate the quiz.';
  }

  return null;
};
