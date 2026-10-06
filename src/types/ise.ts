export type StudyYear = 'year1' | 'year2' | 'year3' | 'year4';
export type AuthMode = 'signin' | 'signup';
export type ActiveModal = 'none' | 'quiz' | 'programming' | 'analysis' | 'upload' | 'history' | 'settings' | 'admin' | 'leaderboard';
export type AppView = 'station' | 'active_quiz' | 'quiz_results' | 'active_prog' | 'prog_results' | 'active_analysis' | 'analysis_results';

export interface UserSession {
  id: string;
  email: string;
  nickname?: string;
  realName?: string;
  studyYear?: StudyYear;
  hideFromLeaderboard?: boolean;
  leaderboardAccepted?: boolean;
  apiKey?: string;
}

export interface AttachedFile {
  name: string;
  mimeType: string;
  isPdf?: boolean;
  base64Data?: string;
  content: string;
  textContent?: string;
}

export interface QuestionReviewDetail {
  questionText: string;
  codeSnippet?: string;
  userAnswer: string[];
  correctAnswers: string[];
  isCorrect: boolean;
  points: number;
  explanation: string;
}

export interface TestHistoryItem {
  id: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  pointsEarned: number;
  date: string;
  rawDate: string;
  timeSpent: string;
  aiFeedback: string;
  weakSpotsAdvice?: string;
  details?: QuestionReviewDetail[];
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  nickname: string;
  realName?: string;
  studyYear: StudyYear;
  monthlyAccuracy: number;
  isePoints: number;
  totalScore: number;
  isCurrentUser: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  codeSnippet?: string;
  type: 'single' | 'multiple' | 'text';
  options?: string[];
  correctAnswers: string[];
  explanation: string;
}

export interface ProgrammingChallenge {
  title: string;
  language: string;
  objective: string;
  requirements: string[];
  patternRules?: string[];
  exampleOutput: string;
  starterCode: string;
}

export interface CodeAnalysisDrill {
  title: string;
  language: string;
  trickyCode: string;
  expectedOutput: string;
  traceExplanation: string;
}

export interface FlaggedMaterial {
  id: string;
  title: string;
  tagName: string;
  submitterEmail: string;
  contentText: string;
  aiVerdictReason: string;
  createdAt: string;
}