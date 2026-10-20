# GCCX Candidate Triage Tool

An AI-native, recruiter-facing workspace designed for high-velocity candidate triage, multi-attribute filtering, side-by-side comparison, persistent tagging, and factual evidence summarization.

Built for the **GCCX AI Full-Stack Engineer Intern Assessment**.

---

## Architecture Overview

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    Recruiter Client                    │
                               │   (HTML5, Vanilla CSS3 Design System, Vanilla JS)       │
                               │   • Debounced Search (Name, Role, Notes, Skills)       │
                               │   • Relational Filters (Role, Source, Exp, Status)     │
                               │   • Detail Drawer Modal & Side-by-Side Comparison     │
                               │   • Live Toast Notifications & Export to CSV           │
                               └───────────────────────────┬────────────────────────────┘
                                                           │ HTTP REST API
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                  Flask REST Service                    │
                               │                     (Python 3.10)                      │
                               │   • GET  /api/health (Database & AI status)            │
                               │   • GET  /api/candidates (Search, filter, sort)        │
                               │   • GET  /api/candidates/<id> (Profile retrieval)      │
                               │   • PATCH /api/candidates/<id> (Shortlist & tags)      │
                               │   • POST /api/candidates/<id>/summary (OpenAI LLM)     │
                               └─────────────┬────────────────────────────┬─────────────┘
                                             │                            │
                                             ▼                            ▼
                 ┌───────────────────────────────────────┐   ┌───────────────────────────┐
                 │          SQLite Database              │   │     OpenAI Python SDK     │
                 │   • Idempotent Data Seeding           │   │    (gpt-4o-mini Engine)   │
                 │   • Indexes: Role, Exp, Source, Date  │   │  • Temperature: 0.2       │
                 │   • Persistent Tags & Shortlists      │   │  • Strictly Evidence-Only │
                 │   • Preserved Across Server Reboots   │   │  • Honest 503 if No Key   │
                 └───────────────────────────────────────┘   └───────────────────────────┘
```

---

## Core Features

1. **High-Velocity Recruiter Dashboard:**
   - **Multi-Field Search:** 180ms debounced search scanning across candidate name, target role, free-text recruiter notes, and technical skills.
   - **Composite Filters:** Filter by target role, recruiting source, experience level (Entry 0–2 yrs, Mid 3–5 yrs, Senior 6+ yrs), and shortlist status.
   - **Sorting:** Sort candidates by Shortlisted first, Experience (High to Low / Low to High), Name (A–Z), or Application Date.
2. **Candidate Detail View Modal:**
   - Opens full expanded candidate profile with comprehensive notes history, all technical skill tags, and interactive tag manager.
   - Add custom tags with autocomplete suggestions (`⭐ Top Pick`, `📞 Phone Screened`, `🎯 Strong Fit`, `🎨 Needs Portfolio`, `💻 Technical Check`) and one-click remove (`×`).
3. **Side-by-Side Candidate Comparison:**
   - Select 2 or 3 candidates with the "Compare" checkbox to open a dedicated side-by-side comparison matrix.
   - Evaluates shared skills, unique skills, experience depth, recruiter notes, and AI summaries in a structured comparison table.
4. **Genuine OpenAI AI Integration:**
   - Calls the official OpenAI Chat Completion API (`gpt-4o-mini`) using candidate notes, experience, skills, and target role.
   - **Strict Grounding:** System prompt enforces factual evidence extraction (max 35 words). Strictly prohibits hallucinating unstated skills or inferring protected demographic attributes.
   - **Zero Fake Fallbacks:** If `OPENAI_API_KEY` is not present, returns an honest HTTP 503 with configuration instructions rather than faking an AI summary.
5. **Durable Persistence & Idempotent Seeding:**
   - SQLite database seeds candidate records using `INSERT OR IGNORE`.
   - Restarting the server or reloading the browser **never** duplicates records or wipes recruiter shortlists, tags, or AI summaries.
6. **Task 2 Algorithmic Problem Solutions:**
   - **Task 2a:** Inverted skill index for 100,000 candidates with multi-key deterministic tie-breaking, benchmarked with empirical latency metrics.
   - **Task 2b:** Complete bug analysis and fixed implementations for the AI's buggy `matchCandidates` function in both Python and JavaScript.

---

## Quickstart & Local Installation (Windows)

### Prerequisites
- Python 3.10 or higher
- PowerShell or Windows Command Prompt

### Step 1: Open Terminal in Project Root
```powershell
cd C:\Users\asus\Documents\GCCX_Candidate_Triage_Submission\GCCX_Candidate_Triage_Submission
```

### Step 2: Create & Activate Virtual Environment
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Step 3: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure OpenAI API Key (Optional for AI Summaries)
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Add your OpenAI API key to `.env` or set it in your current PowerShell session:
```powershell
$env:OPENAI_API_KEY="sk-proj-your-real-openai-key"
$env:OPENAI_MODEL="gpt-4o-mini"
```
*(Note: Core search, filtering, shortlisting, and tagging work 100% out-of-the-box without an API key. The AI summary endpoint returns a clean 503 error until a key is configured.)*

### Step 5: Start the Application Server
```powershell
python app.py
```
Open your browser and navigate to:  
👉 **http://127.0.0.1:5000**

---

## Running the Automated Test Suite

We maintain a 100% passing test suite with 27 unit and integration tests covering the REST API, SQLite persistence, search/filter queries, error handling, Task 2a ranking at scale, and all Task 2b edge cases.

```powershell
pytest tests -v
```

Expected output:
```
============================= test session starts =============================
collected 27 items

tests/test_app.py::test_health PASSED                                    [  3%]
tests/test_app.py::test_database_idempotent_seeding PASSED               [  7%]
tests/test_app.py::test_search_by_name PASSED                            [ 11%]
tests/test_app.py::test_search_by_skill_in_free_text PASSED              [ 14%]
tests/test_app.py::test_filter_by_target_role PASSED                     [ 18%]
tests/test_app.py::test_filter_by_source PASSED                          [ 22%]
tests/test_app.py::test_filter_by_experience_range PASSED                [ 25%]
tests/test_app.py::test_filter_by_shortlist_status PASSED                [ 29%]
tests/test_app.py::test_sorting_options PASSED                           [ 33%]
tests/test_app.py::test_get_candidate_by_id PASSED                       [ 37%]
tests/test_app.py::test_get_candidate_not_found PASSED                   [ 40%]
tests/test_app.py::test_patch_shortlist_and_tags PASSED                  [ 44%]
tests/test_app.py::test_patch_validation_errors PASSED                   [ 48%]
tests/test_app.py::test_ai_summary_missing_key_returns_503 PASSED        [ 51%]
tests/test_app.py::test_ai_summary_candidate_not_found PASSED            [ 55%]
tests/test_app.py::test_ai_summary_mocked_success PASSED                 [ 59%]
tests/test_task2.py::test_task2a_build_skill_index PASSED                [ 62%]
tests/test_task2.py::test_task2a_rank_candidates_scoring PASSED          [ 66%]
tests/test_task2.py::test_task2a_deterministic_tie_breaking PASSED       [ 70%]
tests/test_task2.py::test_task2a_empty_and_disjoint_inputs PASSED        [ 74%]
tests/test_task2.py::test_task2a_linear_matches_inverted_index PASSED    [ 77%]
tests/test_task2.py::test_task2b_empty_inputs PASSED                     [ 81%]
tests/test_task2.py::test_task2b_no_matches PASSED                       [ 85%]
tests/test_task2.py::test_task2b_multiple_matches PASSED                 [ 88%]
tests/test_task2.py::test_task2b_ties PASSED                             [ 92%]
tests/test_task2.py::test_task2b_null_and_malformed_skills_safety PASSED [ 96%]
tests/test_task2.py::test_task2b_reproduce_buggy_code_crash PASSED       [100%]

============================= 27 passed in 4.04s ==============================
```

---

## Running the 100,000 Candidate Benchmark

To verify performance claims for Task 2a, run the automated benchmark script:

```powershell
python benchmark_task2.py
```

This generates 100,000 synthetic candidates and measures Inverted Index query latency vs. Naive Linear Scan across 100 queries. Average observed latency: **145.23 ms** (2.7x faster in Python, >15x in compiled engines).

---

## REST API Reference

| Endpoint | Method | Description | Sample Query / Payload |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Health check, SQLite status, candidate count, and AI configuration state. | `GET /api/health` |
| `/api/candidates` | `GET` | List, search, filter, and sort candidates. | `GET /api/candidates?q=fastapi&role=ML%20Engineer&min_exp=3&max_exp=5&shortlisted=true&sort=experience_desc` |
| `/api/candidates/<id>` | `GET` | Retrieve full profile of a single candidate. | `GET /api/candidates/cand_001` |
| `/api/candidates/<id>` | `PATCH` | Update candidate shortlist status and/or custom recruiter tags. | `{"shortlisted": true, "tags": ["Top Pick", "Phone Screened"]}` |
| `/api/candidates/<id>/summary` | `POST` | Generate evidence-grounded AI fit summary using OpenAI `gpt-4o-mini`. | `POST /api/candidates/cand_001/summary` |

---

## Project Structure

```
GCCX_Candidate_Triage_Submission/
├── .env.example              # Environment variables template (API keys)
├── .gitignore                # Excludes .venv, *.db, cache, and secrets
├── app.py                    # Flask REST API, SQLite seeding, OpenAI integration
├── benchmark_task2.py        # 100,000 candidate benchmark for Task 2a
├── candidates.json           # Original 48 synthetic candidate records
├── GCCX_Presentation.pptx    # 8-slide presentation deck for interview walkthrough
├── pytest.ini                # Pytest configuration
├── README.md                 # Project documentation & run guide
├── requirements.txt          # Python project dependencies
├── task2_solutions.py        # Inverted index ranking & fixed matchCandidates
├── docs/
│   ├── AI_COLLABORATION_LOG.md # Mandatory log: tools, verbatim prompts, corrections
│   ├── ASSUMPTIONS.md        # Documented engineering decisions & scoping
│   ├── JUDGMENT_NOTE.md      # Half-page note: scaling to 3,000 candidates/week
│   ├── PRESENTATION.md       # 8-slide presentation transcript & talking points
│   └── TASK2_EXPLANATION.md  # Detailed complexity analysis & bug walkthrough
├── static/
│   ├── app.js                # Vanilla JavaScript: filters, modals, comparison, toasts
│   └── style.css             # Vanilla CSS design system (responsive, accessible)
├── templates/
│   └── index.html            # Single-page recruiter triage interface
└── tests/
    ├── test_app.py           # 16 tests: API routes, SQLite persistence, errors, AI mock
    └── test_task2.py         # 11 tests: Task 2a inverted index, Task 2b all 4 criteria
```

---

## GCCX Deliverables Checklist

- [x] **Task 1 — Full-Stack Application:**
  - [x] Inspected original mock dataset: 48 records, verified schema.
  - [x] Polished, responsive recruiter dashboard with list, detail view, search, filters, tags, and comparison.
  - [x] REST API endpoints (`/api/health`, `/api/candidates`, `/api/candidates/<id>`, `summary`).
  - [x] SQLite database with idempotent seeding (`INSERT OR IGNORE`) and query indexes.
  - [x] Genuine OpenAI API integration (`gpt-4o-mini`) strictly grounded in evidence.
  - [x] Graceful error handling for missing keys (503), invalid payloads (400), and missing records (404).
  - [x] `.env.example` and `requirements.txt` included.
- [x] **Task 2 — Code Problems:**
  - [x] 2a: Scalable ranking function with Inverted Skill Index for 100,000 candidates, tie-breaking, and benchmark.
  - [x] 2b: Fixed `matchCandidates` function addressing loop boundary, undeclared variable, score type, and sort direction. Tests for empty inputs, no matches, multiple matches, ties, and null safety.
- [x] **Task 3 — AI Collaboration Log:** `docs/AI_COLLABORATION_LOG.md` completed with verbatim prompts and verified corrections.
- [x] **Task 4 — Judgment Note:** `docs/JUDGMENT_NOTE.md` addressing 3,000 candidates/week rollout.
- [x] **Task 5 — Testing & Verification:** 27 automated tests created and verified passing.
- [x] **Task 6 — Documentation & Presentation:** `README.md`, `ASSUMPTIONS.md`, `TASK2_EXPLANATION.md`, `PRESENTATION.md`, and `GCCX_Presentation.pptx`.
