# Judgment Note — Scaling Triage to 3,000 Candidates / Week

**Context:** The recruiter loves the prototype. Leadership wants to roll it out to a client processing 3,000 candidates/week, providing **one additional engineer** and a **two-week sprint**.

---

### 1. What We Would Build First (Week 1–2)
At 3,000 candidates/week (12,000/month), the priority is pipeline reliability, concurrency, and data security:
- **Authentication & RBAC:** Protect candidate PII and isolate client data with role-based access control (Admin, Recruiter, Hiring Manager).
- **Database Hardening & Connection Pooling:** Migrate from local file-based SQLite to managed PostgreSQL (or SQLite WAL mode with connection pooling) and introduce Alembic migrations to prevent schema drift.
- **Asynchronous AI Processing Queue:** Real LLM APIs introduce network latency (1–3s) and rate limits. Move summary generation to an asynchronous background worker (Celery / Redis Queue) with exponential backoff and rate-limit buffering so bulk uploads don't freeze the recruiter UI.
- **Structured Telemetry & Audit Logs:** Instrument request logging, error tracking (Sentry), and track recruiter summary feedback (thumbs up/down) to establish an empirical baseline on AI accuracy.

---

### 2. What We Would Explicitly Refuse to Build Yet
Under a tight two-week constraint, we must reject distractions that do not directly improve triage throughput:
- **Autonomous Hiring / Auto-Rejection:** Absolutely refuse automated pass/fail screening. AI must remain an evidence synthesizer, not an autonomous gatekeeper.
- **Vector / Semantic Embeddings Infrastructure:** Avoid deploying vector databases (Pinecone/Milvus) until we collect 30 days of actual recruiter query logs. Classical indexed search is faster, cheaper, and more predictable at this scale.
- **Automated Candidate Email Outreach:** Defer automated messaging integrations until the client validates candidate selection accuracy.
- **Custom Multi-Tenant Billing & Workflow Configs:** Keep the workflow standardized across the client pilot rather than building premature configuration knobs.

---

### 3. The One Risk to Flag to Management
**Risk:** **Recruiter Automation Bias (Over-Reliance on AI Summaries).**  
Because LLM summaries sound authoritative and grammatically polished, busy recruiters triaging hundreds of profiles will inevitably begin skimming only the AI summary rather than reviewing the underlying notes and resume evidence. If an AI summary omits a subtle disqualifier (e.g., visa constraint, location mismatch, or probation notice) or misinterprets sparse notes, the recruiter may advance the wrong candidate or bypass a strong non-traditional applicant.

**Mitigation:** Keep the raw recruiter notes and skill chips prominently visible directly adjacent to the AI summary. Add an explicit UI confirmation requirement before shortlisting, and run a weekly audit comparing 50 AI summaries against human hiring outcomes.
