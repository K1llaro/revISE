const REQUIRED_SECTION_HEADINGS = [
  'Overview',
  'Topic Notes',
  'How It Works',
  'Key Exam Facts',
  'Last-Minute Recap',
];

export const hasStandardLearnSummaryFormat = (summary: string): boolean => {
  const headings = summary
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s{0,3}(#{1,2})\s+(.+?)\s*#*\s*$/);
      return match ? [match[2].trim().toLocaleLowerCase()] : [];
    });
  return headings.length === REQUIRED_SECTION_HEADINGS.length
    && REQUIRED_SECTION_HEADINGS.every((heading, index) => headings[index] === heading.toLocaleLowerCase());
};

export const LEARN_SUMMARY_TEMPLATE_INSTRUCTIONS = `Use this exact, mandatory Markdown structure and heading order. Do not rename, omit, reorder, or add top-level sections:
## Overview
In 1–3 sentences, explain what these notes cover and name the main topics.
## Topic Notes
Organize all examinable material in source order. Use the exact source slide/section names as ### subheadings when available. For pasted notes without slide headings, use concise descriptive subheadings. Preserve important facts, definitions, examples, values, and qualifications.
## How It Works
Explain source-supported processes as concise numbered cause-and-effect steps. If the source contains no distinct process, write: "No separate process is described in the source."
## Key Exam Facts
List the most important precise facts to memorize for the exam. Include only facts supported by the source.
## Last-Minute Recap
End with a very brief summary of the single most important takeaway from the entire material.

Formatting rules: use short paragraphs and consistent Markdown bullets (- item), one idea per bullet, consistent heading levels, and clean spacing. Do not create additional top-level sections. Use exact heading spelling shown above.
Strict exclusion: completely omit practical exercises, practicals, labs, worksheets, classroom activities, discussion/group tasks, homework, and submission instructions embedded in slides. Do not mention that such tasks exist or that they were omitted. Keep a worked example only when it explains examinable theory, not when it is an assigned activity.
Never invent headings, slide numbers, facts, or citations. Do not output LaTeX markup.`;

export const LEARN_SUMMARY_REFORMAT_PROMPT = (title: string, summary: string) => `Reformat and edit the existing study notes into the mandatory Learn notebook template below. Preserve all source-supported examinable concepts and precise facts. Do not invent facts. Completely remove any practical exercise, lab, worksheet, classroom activity, discussion/group task, homework, or submission instruction; do not mention that excluded tasks existed.

Title: ${title}
Existing study notes:
"""
${summary}
"""

${LEARN_SUMMARY_TEMPLATE_INSTRUCTIONS}

Return JSON only:
{"cleanSummary":"the complete formatted Markdown study note"}`;
