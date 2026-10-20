# Architecture Assumptions & Engineering Decisions

**Project:** GCCX Candidate Triage Tool  
**Candidate:** AI Full-Stack Engineer Intern Applicant  
**Scope:** Round 1 Take-Home Case Study  

---

## 1. Single-User Recruiter Workspace Scope
- **Assumption:** The prototype is designed as an internal, single-recruiter triage tool for an active client search.
- **Decision:** Authentication (JWT / OAuth2 / SSO) and multi-tenant recruiter collaboration were explicitly scoped out of the initial build to focus engineering effort on high-impact core workflows: search velocity, multi-attribute filtering, side-by-side comparison, persistent tagging, and genuine AI evidence summarization.
- **Production Path:** Multi-user locking, role-based access control (RBAC), and team audit trails are documented in [JUDGMENT_NOTE.md](JUDGMENT_NOTE.md) as the first priority for multi-team rollout.

---

## 2. Dataset Fidelity & Idempotency
- **Assumption:** The provided `candidates.json` (48 synthetic records) reflects realistic, imperfect candidate pipeline data (uneven notes, missing portfolios, varied source channels).
- **Decision:** Candidates are imported safely and idempotently into SQLite on server boot using `INSERT OR IGNORE`.
- **Integrity Guarantee:** Restarting or reloading the application will **never** duplicate candidate records, reset shortlist bookmarks, erase recruiter custom tags, or wipe generated AI fit summaries. Primary keys (`cand_001` through `cand_048`) are treated as immutable identifiers.

---

## 3. Data Storage & Indexing Strategy
- **Assumption:** SQLite with foreign keys and composite indexes provides the optimal trade-off between zero-dependency local setup, ACID compliance, and query latency for pipelines ranging from 50 to 10,000 active records.
- **Indexing Decisions:**
  - `idx_candidates_role` on `target_role` (frequent filtering).
  - `idx_candidates_shortlisted` on `shortlisted` (instant review pipeline view).
  - `idx_candidates_source` on `source` (channel effectiveness).
  - `idx_candidates_experience` on `years_experience` (seniority banding).
  - `idx_candidates_applied_date` on `applied_date` (recency sorting).
- **Free-Text Search:** Currently executes case-insensitive pattern matching across `name`, `target_role`, `notes`, and `skills_json`. For corpus scaling beyond 50,000 records, SQLite FTS5 (Full-Text Search) with BM25 ranking is the planned architectural progression.

---

## 4. AI Feature Architecture & Ethical Guardrails
- **Assumption:** Recruiters need factual evidence extraction from unstructured text to triage faster, not an automated AI hiring decision.
- **Decision:** Built a genuine LLM integration using the official OpenAI Python SDK (`gpt-4o-mini`, `temperature=0.2`, `max_tokens=100`).
- **Prompt Engineering & Guardrails:**
  - The model prompt is strictly bounded to the candidate's target role, years of experience, technical skills, and interviewer notes.
  - Strict negative constraints prevent the model from inferring protected traits (gender, ethnicity, age), making ungrounded assumptions, or hallucinating missing skills.
  - If notes are thin or lacking evidence, the model is explicitly instructed to state that evidence is limited.
  - **No Simulated / Fake Fallbacks:** If `OPENAI_API_KEY` is not present, the endpoint returns an honest, explicit HTTP `503 Service Unavailable` with setup instructions. We reject fake summaries because recruiter trust requires transparency.

---

## 5. Candidate Ranking Philosophy (Task 2)
- **Assumption:** Recruiters evaluate job requisitions based on concrete skill overlap rather than subjective black-box match scores.
- **Decision:** Candidates are ranked by distinct required skill overlap:
  $$\text{Score} = |\{\text{Candidate Skills}\} \cap \{\text{Required Skills}\}|$$
- **Determinism:** Ties are broken deterministically by alphabetical name, then candidate ID.
- **Scalability:** For 100,000+ candidates, pre-computing an inverted skill index reduces query time by eliminating full-table scans, visiting only candidates with matching postings.
