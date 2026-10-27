import { test, expect } from 'vitest';
import { hasMixedQuizAnswer, scoreQuizQuestion } from '../src/components/workspace/ActiveViews.tsx';
import { getChoiceLengthBiasWarning, getQuestionTypeCountMismatch } from '../src/lib/quizQuality.ts';
import { hasStandardLearnSummaryFormat } from '../src/lib/learnSummaryFormat.ts';

test('basic sanity check: 1 + 1 equals 2', () => {
  expect(1 + 1).toBe(2);
});

test('Negative Marking scores correct and incorrect option decisions', () => {
  const question = {
    id: 1,
    question: 'Select all correct answers.',
    type: 'multiple',
    options: ['Correct A', 'Wrong B', 'Correct C', 'Wrong D'],
    correctAnswers: ['Correct A', 'Correct C'],
    explanation: '',
  };

  expect(scoreQuizQuestion(question, ['Correct A'], 'negative').points).toBe(0.5);
  expect(scoreQuizQuestion(question, ['Correct A', 'Correct C'], 'negative').points).toBe(1);
  expect(scoreQuizQuestion(question, ['Correct A', 'Wrong B'], 'negative').points).toBe(0);
  expect(scoreQuizQuestion(question, [], 'negative').points).toBe(0);
});

test('mixed MCQ selections are distinguished from fully correct and fully wrong answers', () => {
  const correctAnswers = ['Correct A', 'Correct C'];

  expect(hasMixedQuizAnswer('multiple', ['Correct A', 'Wrong B'], correctAnswers)).toBe(true);
  expect(hasMixedQuizAnswer('multiple', ['Correct A', 'Correct C'], correctAnswers)).toBe(false);
  expect(hasMixedQuizAnswer('multiple', ['Wrong B', 'Wrong D'], correctAnswers)).toBe(false);
  expect(hasMixedQuizAnswer('single', ['Correct A', 'Wrong B'], correctAnswers)).toBe(false);
});

test('quiz generation rejects a clearly length-cued correct answer', () => {
  const questions = [{
    id: 1,
    question: 'Which statement is correct?',
    type: 'single',
    options: [
      'Uses a cache to speed up processing',
      'It enables the processor to access frequently used data more quickly than main memory',
      'Stores a file on disk',
      'Starts the operating system',
    ],
    correctAnswers: ['It enables the processor to access frequently used data more quickly than main memory'],
    explanation: '',
  }];

  expect(getChoiceLengthBiasWarning(questions)).toContain('Question 1');
});

test('quiz generation accepts balanced answer lengths', () => {
  const questions = [{
    id: 1,
    question: 'Which statement is correct?',
    type: 'single',
    options: [
      'Caches keep frequently used data near the processor',
      'Registers keep frequently used data near the processor',
      'Disks keep frequently used data near the processor',
      'Routers keep frequently used data near the processor',
    ],
    correctAnswers: ['Caches keep frequently used data near the processor'],
    explanation: '',
  }];

  expect(getChoiceLengthBiasWarning(questions)).toBeNull();
});

test('quiz generation rejects repeated subtle length cues across a large quiz', () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    question: `Question ${index + 1}`,
    type: 'single',
    options: [
      'Option A is wrong',
      'Option B is wrong',
      'Option C is wrong',
      'Option D is the answer',
    ],
    correctAnswers: ['Option D is the answer'],
    explanation: '',
  }));

  expect(getChoiceLengthBiasWarning(questions)).toContain('longer than their distractors');
});

test('question type mix validation accepts exact requested counts', () => {
  const questions = [
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'text' },
  ];

  expect(getQuestionTypeCountMismatch(questions, { multiple: 4, text: 1 })).toBeNull();
});

test('question type mix validation reports missing requested question types', () => {
  const questions = [
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'multiple' },
    { type: 'single' },
  ];

  expect(getQuestionTypeCountMismatch(questions, { multiple: 4, text: 1 })).toContain('text: expected 1, got 0');
});

test('Learn notes require the exact ordered standard template', () => {
  const summary = `## Overview
This material covers CPU design.
## Topic Notes
### Processor structure
- The processor executes instructions.
## How It Works
1. Fetch, decode, execute.
## Key Exam Facts
- The instruction cycle has three stages.
## Last-Minute Recap
Remember how the stages connect.`;

  expect(hasStandardLearnSummaryFormat(summary)).toBe(true);
  expect(hasStandardLearnSummaryFormat(summary.replace('## Overview', '## Core idea'))).toBe(false);
  expect(hasStandardLearnSummaryFormat(summary.replace('## Topic Notes', '## Extra section\n\n## Topic Notes'))).toBe(false);
});
