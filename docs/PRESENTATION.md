# GCCX Round 1 Interview Presentation — Candidate Triage Tool

**Format:** 8 Slides / 10-Minute Presentation Script & Live Walkthrough  
**Candidate:** AI Full-Stack Engineer Intern Applicant  
**Assessment:** Round 1 Case Study Presentation  

---

## Slide 1 — Title & Executive Summary
- **Title:** GCCX Candidate Triage Tool
- **Subtitle:** An AI-native recruiting workspace for high-velocity candidate evaluation and evidence synthesis.
- **Problem:** Recruiters on active client searches triage hundreds of profiles across disconnected spreadsheets and subjective notes, struggling with slow search, lost recruiter tags, and gut-feel screening.
- **Solution:** A full-stack web application combining fast multi-attribute filtering, persistent shortlist/tag state, side-by-side candidate comparison, and genuine OpenAI-powered evidence summarization.

---

## Slide 2 — The Brief & Engineering Assumptions
- **The Brief:** Transform 48 mock candidate records into a recruiter-facing triage tool with real persistence and genuine LLM integration, accompanied by scalable ranking (100k candidates) and critical AI code review.
- **Assumptions Made:**
  - *Single-Recruiter Workflow:* Auth and multi-tenant isolation scoped out for initial prototype to maximize triage velocity.
  - *Dataset as Ground Truth:* The 48 synthetic records were loaded as-is without artificially "sanitizing" realistic imperfections (e.g. thin notes, missing portfolios).
  - *Idempotent Persistence:* Restarting the server must never overwrite recruiter shortlists, custom tags, or generated AI summaries.
  - *No Fake AI:* If credentials are missing, return an honest HTTP 503 rather than faking candidate qualifications.

---

## Slide 3 — System Architecture & Product Walkthrough
- **Tech Stack:**
  - *Frontend:* Responsive HTML5, Vanilla CSS3 (custom design system, HSL color tokens), Vanilla JavaScript (zero framework bloat).
  - *Backend:* Python 3.10 Flask REST API.
  - *Database:* SQLite with composite performance indexes (`target_role`, `shortlisted`, `years_experience`, `source`, `applied_date`).
  - *AI Layer:* Real OpenAI Python SDK calling `gpt-4o-mini`.
- **Core User Flow:**
  1. Instant search across name, role, notes, and technical skills with 180ms debounce.
  2. Multi-parameter filtering by target role, source, experience range (Junior/Mid/Senior), and status.
  3. One-click shortlisting and persistent tag management with instant remove.
  4. Side-by-side comparison modal for 2–3 selected candidates.
  5. On-demand AI evidence fit summary generation grounded strictly in profile data.

---

## Slide 4 — Key Architectural Decisions That Mattered Most
1. **Idempotent Ingestion (`INSERT OR IGNORE`):**
   - Seeded candidate records with unique primary keys so database restarts never wipe recruiter shortlists or tags.
2. **Inverted Skill Index for 100,000 Candidates:**
   - Pre-computed skill-to-candidate posting lists, visiting only candidates with matching skills ($O(Q \cdot L)$) rather than scanning all 100k items ($O(N \cdot K)$).
3. **Strict Negative Prompting & Honest Error Handling:**
   - Temperature 0.2, max 35 words, strictly bounded to supplied notes. No hallucinated qualifications; explicit HTTP 503 if API key is unconfigured.

---

## Slide 5 — AI Collaboration Workflow & Verification
- **Where AI Accelerated Development:**
  - Rapid prototyping of test fixtures and synthesis of the 100,000 synthetic candidate benchmark generator (`benchmark_task2.py`).
- **Where Human Engineering Overrode AI:**
  - *Task 2b Review:* Identified four critical bugs in AI-generated code that looked superficially correct but failed at runtime.
  - *Database Integrity:* Replaced naive `SELECT COUNT(*)` re-seeding with idempotent SQL statements.
  - *Refused Fake Responses:* Replaced suggested mock fallback strings with clean error handling and status indicators.
- **Verification Standard:** Zero claims without automated test proof. 27 unit and integration tests passing in 4.04s.

---

## Slide 6 — Task 2 Highlights: Coding Under Rigor
- **Task 2a (Ranking at Scale):**
  - Evaluated on 100,000 synthetic candidates.
  - Inverted index built in **0.689s**, query latency **145.23 ms** vs. **390.91 ms** linear scan (**2.7x speedup**).
  - Deterministic tie-breaking: `(-score, candidate.name.casefold(), candidate.id)`.
- **Task 2b (Reviewing the AI's Work):**
  - *Bug 1:* Loop boundary off-by-one (`i <= length`) causing `TypeError` crash on last iteration.
  - *Bug 2:* Undeclared variable `i = 0` leaking to global scope.
  - *Bug 3:* `score: score` saved string array instead of numeric count.
  - *Bug 4:* `a.score - b.score` subtracted arrays (`NaN`) and inverted sort order (ascending instead of descending).

---

## Slide 7 — Judgment Note: Scaling to 3,000 Candidates / Week
- **What to Build First (Week 1–2):**
  - Authentication & Role-Based Access Control (RBAC) to protect candidate PII.
  - Asynchronous background task queue (Redis + Celery) for non-blocking LLM calls with rate-limit retry.
  - Database connection pooling and Alembic schema migrations.
- **What to Explicitly Refuse to Build Yet:**
  - Automated candidate rejection / autonomous hiring decisions.
  - Complex vector database infrastructure prior to gathering real recruiter query logs.
- **The Single Biggest Risk to Flag:**
  - **Recruiter Automation Bias:** Recruiters over-relying on fluent AI summaries without checking original notes. Mitigated by side-by-side note placement and mandatory human verification.

---

## Slide 8 — Next Two-Week Sprint Plan & Live Code Walkthrough
- **Week 1:**
  - Day 1–2: Auth & tenant separation (JWT, role guards).
  - Day 3–4: Asynchronous worker queue for batch LLM extraction.
  - Day 5: FTS5 full-text search integration in SQLite/Postgres.
- **Week 2:**
  - Day 6–7: Structured evaluation harness measuring AI summary accuracy against 100 human-reviewed profiles.
  - Day 8–9: Bulk candidate resume ingestion (PDF/DOCX parsing).
  - Day 10: Client pilot rollout, monitoring telemetry, and recruiter training.
- **Ready for Live Code Walkthrough:**
  - Let's open the running application at `http://127.0.0.1:5000` and inspect `app.py`, `task2_solutions.py`, and the test suite!
