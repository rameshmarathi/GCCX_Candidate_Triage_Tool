"""GCCX Candidate Triage Tool — Flask + SQLite + Real OpenAI API Integration.

Designed for the GCCX AI Full-Stack Engineer Intern Assessment.
Handles candidate triage, multi-field search, relational filtering,
persistent tagging & shortlisting, and real LLM evidence summarization.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from flask import Flask, jsonify, render_template, request
from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "candidates.db"))
DATA_PATH = BASE_DIR / "candidates.json"

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@contextmanager
def get_db():
    """Context manager for SQLite database connection with row factory and foreign keys."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database schema, indexes, and idempotently seed mock candidates.
    
    Uses INSERT OR IGNORE so re-running or restarting the server never overwrites
    recruiter shortlists, custom tags, or AI-generated summaries.
    """
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                target_role TEXT NOT NULL,
                years_experience INTEGER NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT '',
                skills_json TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                applied_date TEXT NOT NULL DEFAULT '',
                shortlisted INTEGER NOT NULL DEFAULT 0,
                tags_json TEXT NOT NULL DEFAULT '[]',
                ai_summary TEXT NOT NULL DEFAULT ''
            )
        """)

        # Performance Indexes for frequent recruiter query patterns
        db.execute("CREATE INDEX IF NOT EXISTS idx_candidates_role ON candidates(target_role)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_candidates_shortlisted ON candidates(shortlisted)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_candidates_experience ON candidates(years_experience)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_candidates_applied_date ON candidates(applied_date)")

        # Idempotent seeding: Only insert records that do not already exist
        if DATA_PATH.exists():
            with DATA_PATH.open(encoding="utf-8") as f:
                candidates = json.load(f)

            db.executemany(
                """
                INSERT OR IGNORE INTO candidates
                    (id, name, target_role, years_experience, source, skills_json, notes, applied_date)
                VALUES
                    (:id, :name, :target_role, :years_experience, :source, :skills, :notes, :applied_date)
                """,
                [
                    {
                        "id": c["id"],
                        "name": c["name"],
                        "target_role": c["target_role"],
                        "years_experience": c.get("years_experience", 0),
                        "source": c.get("source", ""),
                        "skills": json.dumps(c.get("skills", [])),
                        "notes": c.get("notes", ""),
                        "applied_date": c.get("applied_date", "")
                    }
                    for c in candidates
                ]
            )


def row_to_candidate(row) -> dict:
    """Transform SQLite row into standard candidate dictionary with deserialized JSON."""
    c = dict(row)
    c["skills"] = json.loads(c.pop("skills_json", "[]"))
    c["tags"] = json.loads(c.pop("tags_json", "[]"))
    c["shortlisted"] = bool(c.get("shortlisted", 0))
    return c


@app.get("/")
def index():
    """Serve the single-page recruiter triage dashboard."""
    return render_template("index.html")


@app.get("/api/health")
def health():
    """Health check endpoint reporting API and database connectivity status."""
    try:
        with get_db() as db:
            count = db.execute("SELECT COUNT(*) FROM candidates").fetchone()[0]
        return jsonify({
            "status": "ok",
            "database": "sqlite",
            "candidate_count": count,
            "ai_configured": bool(os.getenv("OPENAI_API_KEY"))
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.get("/api/candidates")
def list_candidates():
    """List, search, and filter candidates.
    
    Query parameters:
    - q: Text search across name, target role, notes, and skills
    - role: Exact target role filter
    - source: Exact source filter
    - skill: Substring/token match in candidate skills
    - min_exp: Minimum years of experience
    - max_exp: Maximum years of experience
    - shortlisted: 'true' or 'false'
    - sort: 'shortlist', 'experience_desc', 'experience_asc', 'name_asc', 'date_desc'
    """
    q = request.args.get("q", "").strip()
    role = request.args.get("role", "").strip()
    source = request.args.get("source", "").strip()
    skill = request.args.get("skill", "").strip().casefold()
    min_exp = request.args.get("min_exp", "").strip()
    max_exp = request.args.get("max_exp", "").strip()
    shortlisted = request.args.get("shortlisted", "").strip().lower()
    sort_by = request.args.get("sort", "default").strip()

    clauses, params = [], []

    # Free-text search covering candidate name, notes, target role, and skills JSON
    if q:
        like = f"%{q.casefold()}%"
        clauses.append(
            "(LOWER(name) LIKE ? OR LOWER(notes) LIKE ? OR LOWER(target_role) LIKE ? OR LOWER(skills_json) LIKE ?)"
        )
        params.extend([like, like, like, like])

    if role:
        clauses.append("target_role = ?")
        params.append(role)

    if source:
        clauses.append("source = ?")
        params.append(source)

    if min_exp.isdigit():
        clauses.append("years_experience >= ?")
        params.append(int(min_exp))

    if max_exp.isdigit():
        clauses.append("years_experience <= ?")
        params.append(int(max_exp))

    if shortlisted in ("true", "false"):
        clauses.append("shortlisted = ?")
        params.append(1 if shortlisted == "true" else 0)

    # Sorting options
    if sort_by == "experience_desc":
        order_clause = "years_experience DESC, name COLLATE NOCASE"
    elif sort_by == "experience_asc":
        order_clause = "years_experience ASC, name COLLATE NOCASE"
    elif sort_by == "date_desc":
        order_clause = "applied_date DESC, name COLLATE NOCASE"
    elif sort_by == "name_asc":
        order_clause = "name COLLATE NOCASE ASC"
    else:
        # Default: Shortlisted candidates on top, then alphabetical
        order_clause = "shortlisted DESC, name COLLATE NOCASE"

    where_sql = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"SELECT * FROM candidates{where_sql} ORDER BY {order_clause}"

    with get_db() as db:
        rows = [row_to_candidate(r) for r in db.execute(sql, params).fetchall()]
        roles = [r[0] for r in db.execute("SELECT DISTINCT target_role FROM candidates ORDER BY target_role")]
        sources = [r[0] for r in db.execute("SELECT DISTINCT source FROM candidates ORDER BY source")]
        
        # Experience range metadata for UI slider/filters
        exp_stats = db.execute("SELECT MIN(years_experience), MAX(years_experience) FROM candidates").fetchone()
        min_available_exp = exp_stats[0] if exp_stats and exp_stats[0] is not None else 0
        max_available_exp = exp_stats[1] if exp_stats and exp_stats[1] is not None else 10

        # Unique skills pool for suggestion chips
        skills_rows = db.execute("SELECT skills_json FROM candidates").fetchall()
        all_skills = sorted({
            s for r in skills_rows for s in json.loads(r[0])
        })

    # Precise skill filtering (case-insensitive substring or token match)
    if skill:
        rows = [c for c in rows if any(skill in s.casefold() for s in c["skills"])]

    return jsonify({
        "candidates": rows,
        "total": len(rows),
        "roles": roles,
        "sources": sources,
        "all_skills": all_skills,
        "min_experience": min_available_exp,
        "max_experience": max_available_exp
    })


@app.get("/api/candidates/<candidate_id>")
def get_candidate(candidate_id):
    """Retrieve full details of a single candidate by ID."""
    with get_db() as db:
        row = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if row is None:
        return jsonify({"error": f"Candidate '{candidate_id}' not found"}), 404
    return jsonify({"candidate": row_to_candidate(row)})


@app.patch("/api/candidates/<candidate_id>")
def update_candidate(candidate_id):
    """Update candidate shortlist status and/or custom recruiter tags.
    
    Payload schema:
    {
        "shortlisted": bool (optional),
        "tags": list[str] (optional)
    }
    """
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON body. Expected an object."}), 400

    updates, params = [], []

    if "shortlisted" in payload:
        if not isinstance(payload["shortlisted"], bool):
            return jsonify({"error": "'shortlisted' must be a boolean"}), 400
        updates.append("shortlisted = ?")
        params.append(1 if payload["shortlisted"] else 0)

    if "tags" in payload:
        tags = payload["tags"]
        if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
            return jsonify({"error": "'tags' must be a list of strings"}), 400

        # Sanitize tags: trim, drop empties, enforce max 40 chars each, max 15 tags per candidate
        clean_tags = list(dict.fromkeys(t.strip()[:40] for t in tags if t.strip()))[:15]
        updates.append("tags_json = ?")
        params.append(json.dumps(clean_tags))

    if not updates:
        return jsonify({"error": "Provide 'shortlisted' and/or 'tags' in update payload"}), 400

    params.append(candidate_id)

    with get_db() as db:
        cur = db.execute(f"UPDATE candidates SET {', '.join(updates)} WHERE id = ?", params)
        if cur.rowcount == 0:
            return jsonify({"error": f"Candidate '{candidate_id}' not found"}), 404
        row = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()

    return jsonify({
        "message": "Candidate updated successfully",
        "candidate": row_to_candidate(row)
    })


@app.post("/api/candidates/<candidate_id>/summary")
def generate_summary(candidate_id):
    """Generate an evidence-grounded AI fit summary using the official OpenAI API.
    
    Requirements satisfied:
    - Calls real LLM API using the OpenAI Python SDK (no mock/simulated fallback).
    - Requires OPENAI_API_KEY environment variable; returns clean 503 if not set.
    - Grounded strictly in candidate target_role, years_experience, skills, and notes.
    - Instructs model not to extrapolate, hallucinate, or infer protected traits.
    - Caches output into candidates.ai_summary so recruiters retain past analyses.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not api_key.strip():
        return jsonify({
            "error": "OPENAI_API_KEY is not configured in the environment. "
                     "Add your key to the environment or .env file to enable live AI summaries."
        }), 503

    with get_db() as db:
        row = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()

    if row is None:
        return jsonify({"error": f"Candidate '{candidate_id}' not found"}), 404

    c = row_to_candidate(row)
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    try:
        client = OpenAI(api_key=api_key.strip())
        prompt_content = {
            "target_role": c["target_role"],
            "years_experience": c["years_experience"],
            "skills": c["skills"],
            "notes": c["notes"]
        }

        response = client.chat.completions.create(
            model=model_name,
            temperature=0.2,
            max_tokens=100,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an objective recruiting analyst providing evidence-grounded triage notes. "
                        "In one concise sentence (maximum 35 words), summarize the role-relevant factual "
                        "evidence found in the candidate's profile for their target role. "
                        "Do NOT invent unstated qualifications, infer protected attributes, or make hiring decisions. "
                        "If profile evidence is limited or thin, explicitly state that."
                    )
                },
                {
                    "role": "user",
                    "content": json.dumps(prompt_content)
                }
            ]
        )

        summary = (response.choices[0].message.content or "").strip()
        if not summary:
            return jsonify({"error": "Model returned an empty summary. Please retry."}), 502

        with get_db() as db:
            db.execute("UPDATE candidates SET ai_summary = ? WHERE id = ?", (summary, candidate_id))

        return jsonify({
            "candidate_id": candidate_id,
            "summary": summary,
            "model": model_name
        })

    except Exception as exc:
        app.logger.exception(f"OpenAI API call failed for candidate {candidate_id}")
        return jsonify({
            "error": f"OpenAI request failed: {str(exc)}. Please check your API key, model quota, and network."
        }), 502


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found"}), 404
    return render_template("index.html"), 404


init_db()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print(f"GCCX Candidate Triage Tool running on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=debug)
