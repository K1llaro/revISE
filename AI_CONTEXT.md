# revISE - Project Architecture & Context Guide

## 1. Project Overview
**revISE** is a highly customized, AI-driven Learning Station built specifically for students of the **Immersive Software Engineering (ISE)** program at the University of Limerick (UL).
It generates dynamic quizzes, programming exercises, and mental code-tracing drills based on the actual 2026 UL curriculum.

## 2. Tech Stack
- **Framework:** Astro (SSR mode enabled via `@astrojs/node`).
- **UI/Styling:** React, Tailwind CSS, Lucide React icons.
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, OAuth).
- **AI Engine:** Google Gemini 3 (using `gemini-3.5-flash-lite`, `gemini-3.8-flash`).

## 3. Design Language & UI Constraints
- **Palette:** "LM173 Telemetry" (Deep space background `#060c20`, Neon Green `#3ccb57`, Alert Red, Sky Blue, Orange).
- **Layout:** The app functions as a sleek Desktop-like Web Workstation (pinned header & footer) while being 100% responsive and touch-optimized for mobile phones and tablets (using `100dvh`, responsive Tailwind grids, and smooth internal scrolling so content is never clipped on smaller viewports).
- **Scrollbars:** Global browser scrollbars are hidden. Custom thin (5px) dark scrollbars are implemented inside scrollable workspace and modal containers.
- **Forms:** Firefox autofill yellow-background bugs are mitigated using `box-shadow inset` in global CSS and the `readOnly` + `onFocus` trick in React inputs.

## 4. Hard-Won Architectural Decisions (CRITICAL)

### A. Authentication (Strict GitHub OAuth)
We abandoned email/SMTP verification due to Microsoft 365 quarantine rules.
- **Auth Flow:** Users log in strictly via GitHub OAuth.
- **Security Gateway:** In `ISEasyApp.tsx`, we intercept the GitHub session and call `https://api.github.com/user/emails`. We strictly verify that the user has a `verified: true` email matching the UL format `/^\d+@studentmail\.ul\.ie$/i`.
- **Admin Exception:** The email `dinosaurkiril@gmail.com` bypasses the student ID check and has global Admin privileges.

### B. AI Guardrails & Ingestion
Whenever a user uploads files (PDF/Text) to generate a quiz or upload knowledge, Gemini MUST act as a gatekeeper (`contentVerdict`):
- `rejected`: Vendor software (Dell, Intel), installers, memes. **ZERO bytes are saved to Supabase.**
- `flagged`: Niche/suspicious. Saved to Supabase, but hidden from students. Sent to Admin Modal.
- `approved`: Genuine CS material. Saved, and a curriculum tag (e.g., `#Java_Arrays`) is created/reused.

### C. PDF Handling
PDFs are **NOT** read as raw text in the browser. `FileReader` uses `readAsDataURL` to extract the Base64 string. We pass this Base64 directly to Gemini as `inlineData` (mimetype: `application/pdf`) so the multimodal AI can "see" the slides natively.

### D. Leaderboard Mathematics
The leaderboard ranking is unbounded. The formula is:
`Total Rating = Total ISE Points Earned * (Monthly Accuracy % / 100)`
This prevents spamming easy tasks and heavily rewards high accuracy. Tie-breakers are resolved by Accuracy -> Points -> Nickname.

## 5. Development Rules for AI Assistants
- Preserve the sleek desktop workstation aesthetic (pinned header & footer) while ensuring full responsiveness on mobile screens (avoid viewport overflow locks that clip content).
- NEVER suggest adding email SMTP verification back (we strictly use GitHub OAuth).
- When writing Gemini API calls, always use the fallback array `['gemini-3.5-flash-lite', 'gemini-3.8-flash']` and `thinkingLevel: 'medium'` (avoid deprecated `thinkingBudget`).
- Maintain the strict separation of components created during the massive refactoring (AuthCard, ActiveViews, WorkspaceModals, AuthenticatedWorkspace).