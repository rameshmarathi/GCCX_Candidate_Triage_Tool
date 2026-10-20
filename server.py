"""
GCCX Candidate Triage Application - Backend Server
Provides SQLite database persistence, RESTful API, AI Candidate Triage & Fit Analysis Engine.
"""

import os
import json
import sqlite3
import datetime
import re
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "triage.db")
CANDIDATES_JSON = os.path.join(BASE_DIR, "projects", "gccx_candidate_triage", "sources", "candidates.json")

# Fallback path if file is located directly in data or project
if not os.path.exists(CANDIDATES_JSON):
    alt_path = os.path.join(BASE_DIR, "candidates.json")
    if os.path.exists(alt_path):
        CANDIDATES_JSON = alt_path

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
CORS(app)

# Role expectations for semantic AI matching
ROLE_SKILL_BENCHMARKS = {
    "ML Engineer": {
        "core": ["Python", "PyTorch", "TensorFlow", "FastAPI", "GCP", "AWS", "Docker", "Kubernetes", "System Design"],
        "adjacent": ["PostgreSQL", "Kafka", "Redis"],
        "min_recommended_exp": 2
    },
    "Backend Engineer": {
        "core": ["Java", "Spring Boot", "Kotlin", "Go", "Python", "FastAPI", "Django", "PostgreSQL", "MySQL", "Redis", "Kafka", "REST APIs", "System Design", "Docker", "Kubernetes"],
        "adjacent": ["AWS", "GCP", "GraphQL", "MongoDB"],
        "min_recommended_exp": 2
    },
    "Frontend Engineer": {
        "core": ["React", "Next.js", "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind CSS", "Redux", "GraphQL", "REST APIs"],
        "adjacent": ["Node.js", "Jest", "Webpack", "Docker"],
        "min_recommended_exp": 1
    },
    "Full-Stack Engineer": {
        "core": ["TypeScript", "React", "Next.js", "Node.js", "Python", "FastAPI", "PostgreSQL", "Docker", "REST APIs"],
        "adjacent": ["Redis", "AWS", "MongoDB", "Tailwind CSS"],
        "min_recommended_exp": 2
    },
    "DevOps Engineer": {
        "core": ["Kubernetes", "Docker", "Terraform", "AWS", "GCP", "CI/CD", "Linux", "Python", "Bash", "Prometheus"],
        "adjacent": ["Go", "Kafka", "PostgreSQL"],
        "min_recommended_exp": 3
    },
    "Platform Engineer": {
        "core": ["Kubernetes", "Kafka", "AWS", "GCP", "Go", "Docker", "Terraform", "System Design", "Linux"],
        "adjacent": ["Python", "PostgreSQL", "Redis"],
        "min_recommended_exp": 3
    },
    "Data Engineer": {
        "core": ["Python", "SQL", "Spark", "Kafka", "Airflow", "PostgreSQL", "Snowflake", "AWS", "GCP", "Docker"],
        "adjacent": ["Java", "Redis", "MongoDB"],
        "min_recommended_exp": 2
    },
    "Mobile Engineer (Android)": {
        "core": ["Kotlin", "Java", "Android SDK", "Jetpack Compose", "REST APIs", "System Design", "Room", "Coroutines"],
        "adjacent": ["Docker", "Firebase", "TypeScript"],
        "min_recommended_exp": 2
    },
    "Mobile Engineer (iOS)": {
        "core": ["Swift", "SwiftUI", "iOS SDK", "Objective-C", "REST APIs", "Combine", "System Design"],
        "adjacent": ["GraphQL", "Firebase"],
        "min_recommended_exp": 2
    },
    "QA / SDET": {
        "core": ["Python", "Java", "Selenium", "Cypress", "Playwright", "REST APIs", "CI/CD", "Docker", "Postman"],
        "adjacent": ["TypeScript", "Kubernetes", "Linux"],
        "min_recommended_exp": 2
    }
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(force_reseed=False):
    """Initializes the database and loads candidates.json if empty or requested."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_role TEXT NOT NULL,
        years_experience INTEGER NOT NULL,
        source TEXT NOT NULL,
        skills TEXT NOT NULL,
        notes TEXT,
        applied_date TEXT,
        triage_status TEXT DEFAULT 'Unreviewed',
        ai_fit_score INTEGER DEFAULT NULL,
        ai_summary TEXT DEFAULT NULL,
        ai_recommendation TEXT DEFAULT NULL,
        ai_strengths TEXT DEFAULT NULL,
        ai_concerns TEXT DEFAULT NULL,
        ai_questions TEXT DEFAULT NULL,
        recruiter_notes TEXT DEFAULT '',
        updated_at TEXT
    )
    """)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM candidates")
    count = cur.fetchone()[0]

    if count == 0 or force_reseed:
        if force_reseed:
            cur.execute("DELETE FROM candidates")

        if os.path.exists(CANDIDATES_JSON):
            with open(CANDIDATES_JSON, "r", encoding="utf-8") as f:
                candidates = json.load(f)

            now_str = datetime.datetime.utcnow().isoformat() + "Z"
            for c in candidates:
                skills_json = json.dumps(c.get("skills", []))
                cur.execute("""
                INSERT INTO candidates (
                    id, name, target_role, years_experience, source, skills, notes, applied_date, triage_status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Unreviewed', ?)
                """, (
                    c["id"],
                    c["name"],
                    c["target_role"],
                    int(c.get("years_experience", 0)),
                    c.get("source", "Direct"),
                    skills_json,
                    c.get("notes", ""),
                    c.get("applied_date", ""),
                    now_str
                ))
            conn.commit()
            print(f"[DB] Initialized with {len(candidates)} candidates from {CANDIDATES_JSON}")

    conn.close()


def evaluate_candidate_ai(candidate, api_key=None):
    """
    Evaluates candidate fit using OpenAI API if configured,
    or falls back to an intelligent multi-signal heuristic NLP evaluation engine.
    """
    name = candidate.get("name", "Candidate")
    role = candidate.get("target_role", "")
    years = candidate.get("years_experience", 0)
    source = candidate.get("source", "")
    notes = candidate.get("notes", "")
    skills = candidate.get("skills", [])
    if isinstance(skills, str):
        try:
            skills = json.loads(skills)
        except Exception:
            skills = [s.strip() for s in skills.split(",") if s.strip()]

    # If an OpenAI API Key is provided or in environment, attempt live LLM call
    openai_key = api_key or os.environ.get("OPENAI_API_KEY")
    if openai_key and len(openai_key.strip()) > 10:
        try:
            import openai
            client = openai.OpenAI(api_key=openai_key.strip())
            prompt = f"""
You are an expert technical recruiting AI for GCCX evaluating candidates.
Analyze this candidate for the position of {role}:
Candidate: {name}
Experience: {years} years
Source: {source}
Skills: {', '.join(skills)}
Recruiter/Screening Notes: "{notes}"

Respond with ONLY a valid JSON object in this exact schema:
{{
  "fit_score": <integer from 1 to 100>,
  "recommendation": <"Strong Shortlist" | "Phone Screen" | "Review Later" | "Reject">,
  "one_line_summary": <concise 1-2 sentence executive fit summary highlighting value & risk>,
  "strengths": [<bullet 1>, <bullet 2>, <bullet 3>],
  "concerns": [<bullet 1>, <bullet 2>],
  "suggested_questions": [<specific probe 1 based on notes>, <specific probe 2>]
}}
"""
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a precise technical hiring evaluator. Return only raw JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=600
            )
            raw = completion.choices[0].message.content.strip()
            # Clean possible markdown fence
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)
            parsed = json.loads(raw)
            return {
                "fit_score": int(parsed.get("fit_score", 70)),
                "recommendation": parsed.get("recommendation", "Phone Screen"),
                "one_line_summary": parsed.get("one_line_summary", ""),
                "strengths": parsed.get("strengths", []),
                "concerns": parsed.get("concerns", []),
                "suggested_questions": parsed.get("suggested_questions", [])
            }
        except Exception as e:
            print(f"[AI] OpenAI call failed: {e}. Falling back to internal semantic engine.")

    # High-fidelity semantic NLP rule engine fallback
    benchmark = ROLE_SKILL_BENCHMARKS.get(role, {
        "core": ["Python", "JavaScript", "Docker", "SQL", "REST APIs"],
        "adjacent": ["AWS", "Git"],
        "min_recommended_exp": 2
    })

    skills_lower = [s.lower() for s in skills]
    core_matches = [s for s in benchmark["core"] if s.lower() in skills_lower]
    adj_matches = [s for s in benchmark["adjacent"] if s.lower() in skills_lower]

    skill_coverage = len(core_matches) / max(1, len(benchmark["core"]))
    match_ratio = len(core_matches) / max(1, len(skills))

    base_score = 50
    strengths = []
    concerns = []
    questions = []

    # Experience evaluation
    min_exp = benchmark.get("min_recommended_exp", 2)
    if years >= min_exp:
        exp_boost = min(20, (years - min_exp) * 4 + 10)
        base_score += exp_boost
        strengths.append(f"{years} years of professional experience meets seniority baseline for {role}.")
    else:
        base_score -= 10
        concerns.append(f"Early career with {years} year(s) exp against {min_exp}+ target baseline.")
        questions.append(f"How quickly have you ramped up on end-to-end development in past projects?")

    # Skills evaluation
    if core_matches:
        strengths.append(f"Direct role alignment in: {', '.join(core_matches)}.")
        base_score += min(25, len(core_matches) * 6)
    else:
        concerns.append(f"Missing core expected stack for {role} (e.g. {', '.join(benchmark['core'][:3])}).")
        base_score -= 15
        questions.append(f"Given your current skills ({', '.join(skills[:3])}), how would you transition to {role} core tools?")

    if adj_matches:
        strengths.append(f"Helpful complementary skills: {', '.join(adj_matches)}.")
        base_score += 5

    # Notes NLP sentiment & signal extraction
    notes_lower = notes.lower()
    
    # Positive signals
    if "series b" in notes_lower or "startup" in notes_lower:
        base_score += 6
        strengths.append("High startup velocity background with wearing multiple hats.")
    if "ownership" in notes_lower or "autonomy" in notes_lower:
        questions.append("Can you walk through a high-impact feature where you took full ownership from RFC to production?")
    if "dsa" in notes_lower or "competitive programming" in notes_lower:
        base_score += 7
        strengths.append("Demonstrated solid problem solving & algorithmic fundamentals.")
    if "ai tools" in notes_lower:
        base_score += 5
        strengths.append("Actively integrates modern AI coding workflows into daily engineering.")

    # Risk signals
    if "thin on specifics" in notes_lower or "buzzwords" in notes_lower:
        base_score -= 14
        concerns.append("Resume contains buzzwords without clear quantifiable business outcomes.")
        questions.append("Can you deep dive into your most technically challenging project with verifiable metrics?")
    if "process-heavy" in notes_lower or "unclear how much autonomy" in notes_lower:
        base_score -= 8
        concerns.append("Coming from process-heavy enterprise; autonomy and pace need validation.")
        questions.append("How do you handle ambiguous requirements and self-directed sprint pacing?")
    if "untested" in notes_lower or "mostly backend-only" in notes_lower:
        base_score -= 6
        concerns.append("Limited demonstrated breadth across full stack requirements.")
        questions.append("Describe a time you had to jump outside your comfort zone into the frontend/ops layer.")
    if "no portfolio" in notes_lower or "following up" in notes_lower:
        base_score -= 5
        concerns.append("Portfolio/code samples currently missing.")
        questions.append("Do you have public GitHub repositories or system diagrams you can showcase?")

    # Source signal
    if source == "Referral":
        base_score += 5
        strengths.append("High-intent employee or network referral.")
    elif source == "Conference" or source == "GCCX Sourced":
        base_score += 3

    # Clamping fit score
    final_score = max(20, min(95, base_score))

    # Triage recommendation logic
    if final_score >= 78:
        rec = "Strong Shortlist"
    elif final_score >= 62:
        rec = "Phone Screen"
    elif final_score >= 48:
        rec = "Review Later"
    else:
        rec = "Reject"

    # Executive one-line summary
    if rec == "Strong Shortlist":
        summary = f"High-confidence fit for {role} with {years}y exp and strong stack overlap ({', '.join(core_matches[:3])}). Recommend immediate technical round."
    elif rec == "Phone Screen":
        summary = f"Promising candidate with solid {years}y foundation; verify practical autonomy and {core_matches[0] if core_matches else 'system design'} breadth during initial screen."
    elif rec == "Review Later":
        summary = f"Mixed signal profile: has relevant background, but recruiter notes indicate gaps in verifiable project specifics or stack alignment."
    else:
        summary = f"Low fit for {role}: significant stack misalignment and thin verifiable achievements compared to target benchmarks."

    return {
        "fit_score": final_score,
        "recommendation": rec,
        "one_line_summary": summary,
        "strengths": strengths[:3],
        "concerns": concerns[:3],
        "suggested_questions": questions[:3]
    }


# ==================== REST API ROUTES ====================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/candidates", methods=["GET"])
def get_candidates():
    """Returns filtered and sorted candidates."""
    conn = get_db()
    cur = conn.cursor()

    search = request.args.get("search", "").strip()
    role = request.args.get("role", "").strip()
    source = request.args.get("source", "").strip()
    status = request.args.get("status", "").strip()
    min_exp = request.args.get("min_exp", type=int)
    max_exp = request.args.get("max_exp", type=int)
    sort_by = request.args.get("sort_by", "applied_date")
    sort_order = request.args.get("sort_order", "desc").lower()

    query = "SELECT * FROM candidates WHERE 1=1"
    params = []

    if search:
        search_pattern = f"%{search}%"
        query += " AND (name LIKE ? OR target_role LIKE ? OR skills LIKE ? OR notes LIKE ? OR source LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])

    if role:
        query += " AND target_role = ?"
        params.append(role)

    if source:
        query += " AND source = ?"
        params.append(source)

    if status and status != "All":
        query += " AND triage_status = ?"
        params.append(status)

    if min_exp is not None:
        query += " AND years_experience >= ?"
        params.append(min_exp)

    if max_exp is not None:
        query += " AND years_experience <= ?"
        params.append(max_exp)

    # Sorting
    allowed_sorts = {
        "applied_date": "applied_date",
        "years_experience": "years_experience",
        "ai_fit_score": "ai_fit_score",
        "name": "name"
    }
    col = allowed_sorts.get(sort_by, "applied_date")
    direction = "ASC" if sort_order == "asc" else "DESC"

    if col == "ai_fit_score":
        # Put NULLs last when sorting by score
        query += f" ORDER BY (ai_fit_score IS NULL), ai_fit_score {direction}"
    else:
        query += f" ORDER BY {col} {direction}"

    cur.execute(query, params)
    rows = cur.fetchall()

    candidates = []
    for r in rows:
        d = dict(r)
        d["skills"] = json.loads(d["skills"]) if d.get("skills") else []
        d["ai_strengths"] = json.loads(d["ai_strengths"]) if d.get("ai_strengths") else []
        d["ai_concerns"] = json.loads(d["ai_concerns"]) if d.get("ai_concerns") else []
        d["ai_questions"] = json.loads(d["ai_questions"]) if d.get("ai_questions") else []
        candidates.append(d)

    conn.close()
    return jsonify({
        "success": True,
        "count": len(candidates),
        "candidates": candidates
    })


@app.route("/api/candidates/<candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "error": "Candidate not found"}), 404

    d = dict(row)
    d["skills"] = json.loads(d["skills"]) if d.get("skills") else []
    d["ai_strengths"] = json.loads(d["ai_strengths"]) if d.get("ai_strengths") else []
    d["ai_concerns"] = json.loads(d["ai_concerns"]) if d.get("ai_concerns") else []
    d["ai_questions"] = json.loads(d["ai_questions"]) if d.get("ai_questions") else []
    return jsonify({"success": True, "candidate": d})


@app.route("/api/candidates/<candidate_id>", methods=["PATCH"])
def update_candidate(candidate_id):
    data = request.get_json() or {}
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return jsonify({"success": False, "error": "Candidate not found"}), 404

    fields = []
    params = []

    if "triage_status" in data:
        fields.append("triage_status = ?")
        params.append(data["triage_status"])

    if "recruiter_notes" in data:
        fields.append("recruiter_notes = ?")
        params.append(data["recruiter_notes"])

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    fields.append("updated_at = ?")
    params.append(now_str)

    params.append(candidate_id)
    cur.execute(f"UPDATE candidates SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()

    cur.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    updated = dict(cur.fetchone())
    conn.close()

    updated["skills"] = json.loads(updated["skills"]) if updated.get("skills") else []
    updated["ai_strengths"] = json.loads(updated["ai_strengths"]) if updated.get("ai_strengths") else []
    updated["ai_concerns"] = json.loads(updated["ai_concerns"]) if updated.get("ai_concerns") else []
    updated["ai_questions"] = json.loads(updated["ai_questions"]) if updated.get("ai_questions") else []

    return jsonify({"success": True, "candidate": updated})


@app.route("/api/candidates/<candidate_id>/ai-triage", methods=["POST"])
def run_ai_triage(candidate_id):
    """Generates AI fit evaluation and saves it to SQLite database."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    row = cur.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Candidate not found"}), 404

    candidate = dict(row)
    candidate["skills"] = json.loads(candidate["skills"]) if candidate.get("skills") else []

    body = request.get_json(silent=True) or {}
    api_key = body.get("api_key")

    eval_result = evaluate_candidate_ai(candidate, api_key=api_key)

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    cur.execute("""
    UPDATE candidates SET
        ai_fit_score = ?,
        ai_summary = ?,
        ai_recommendation = ?,
        ai_strengths = ?,
        ai_concerns = ?,
        ai_questions = ?,
        updated_at = ?
    WHERE id = ?
    """, (
        eval_result["fit_score"],
        eval_result["one_line_summary"],
        eval_result["recommendation"],
        json.dumps(eval_result["strengths"]),
        json.dumps(eval_result["concerns"]),
        json.dumps(eval_result["suggested_questions"]),
        now_str,
        candidate_id
    ))
    conn.commit()

    cur.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    updated = dict(cur.fetchone())
    conn.close()

    updated["skills"] = json.loads(updated["skills"]) if updated.get("skills") else []
    updated["ai_strengths"] = eval_result["strengths"]
    updated["ai_concerns"] = eval_result["concerns"]
    updated["ai_questions"] = eval_result["suggested_questions"]

    return jsonify({
        "success": True,
        "evaluation": eval_result,
        "candidate": updated
    })


@app.route("/api/candidates/batch-ai-triage", methods=["POST"])
def batch_ai_triage():
    """Runs AI analysis for all or unreviewed candidates."""
    body = request.get_json(silent=True) or {}
    api_key = body.get("api_key")
    overwrite_existing = body.get("overwrite", False)

    conn = get_db()
    cur = conn.cursor()

    if overwrite_existing:
        cur.execute("SELECT * FROM candidates")
    else:
        cur.execute("SELECT * FROM candidates WHERE ai_fit_score IS NULL")

    rows = cur.fetchall()
    updated_count = 0

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    for r in rows:
        c = dict(r)
        c["skills"] = json.loads(c["skills"]) if c.get("skills") else []
        res = evaluate_candidate_ai(c, api_key=api_key)

        cur.execute("""
        UPDATE candidates SET
            ai_fit_score = ?,
            ai_summary = ?,
            ai_recommendation = ?,
            ai_strengths = ?,
            ai_concerns = ?,
            ai_questions = ?,
            updated_at = ?
        WHERE id = ?
        """, (
            res["fit_score"],
            res["one_line_summary"],
            res["recommendation"],
            json.dumps(res["strengths"]),
            json.dumps(res["concerns"]),
            json.dumps(res["suggested_questions"]),
            now_str,
            c["id"]
        ))
        updated_count += 1

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "processed": updated_count,
        "message": f"Successfully evaluated {updated_count} candidates."
    })


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Provides high-level triage analytics and metric breakdowns."""
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM candidates")
    total = cur.fetchone()[0]

    cur.execute("SELECT triage_status, COUNT(*) FROM candidates GROUP BY triage_status")
    status_counts = dict(cur.fetchall())

    cur.execute("SELECT target_role, COUNT(*) FROM candidates GROUP BY target_role ORDER BY COUNT(*) DESC")
    role_counts = dict(cur.fetchall())

    cur.execute("SELECT source, COUNT(*) FROM candidates GROUP BY source ORDER BY COUNT(*) DESC")
    source_counts = dict(cur.fetchall())

    cur.execute("SELECT AVG(years_experience), MIN(years_experience), MAX(years_experience) FROM candidates")
    exp_stats = cur.fetchone()

    cur.execute("SELECT AVG(ai_fit_score), COUNT(ai_fit_score) FROM candidates WHERE ai_fit_score IS NOT NULL")
    ai_stats = cur.fetchone()

    # Skill frequency
    cur.execute("SELECT skills FROM candidates")
    skills_data = cur.fetchall()
    skill_freq = {}
    for (s_json,) in skills_data:
        try:
            s_list = json.loads(s_json)
            for skill in s_list:
                skill_freq[skill] = skill_freq.get(skill, 0) + 1
        except Exception:
            pass

    top_skills = sorted(skill_freq.items(), key=lambda x: x[1], reverse=True)[:10]

    conn.close()

    return jsonify({
        "success": True,
        "total": total,
        "by_status": status_counts,
        "by_role": role_counts,
        "by_source": source_counts,
        "avg_experience": round(exp_stats[0] or 0, 1),
        "min_experience": exp_stats[1] or 0,
        "max_experience": exp_stats[2] or 0,
        "avg_ai_score": round(ai_stats[0] or 0, 1),
        "ai_analyzed_count": ai_stats[1] or 0,
        "top_skills": top_skills
    })


@app.route("/api/reset-db", methods=["POST"])
def reset_db():
    init_db(force_reseed=True)
    return jsonify({"success": True, "message": "Database reset to initial mock data."})


@app.route("/api/export", methods=["GET"])
def export_candidates():
    """Exports candidates as CSV or JSON."""
    fmt = request.args.get("format", "csv").lower()
    status = request.args.get("status", "")

    conn = get_db()
    cur = conn.cursor()

    if status and status != "All":
        cur.execute("SELECT * FROM candidates WHERE triage_status = ? ORDER BY ai_fit_score DESC", (status,))
    else:
        cur.execute("SELECT * FROM candidates ORDER BY ai_fit_score DESC")

    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    if fmt == "json":
        for r in rows:
            r["skills"] = json.loads(r["skills"]) if r.get("skills") else []
        return Response(
            json.dumps(rows, indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": "attachment;filename=gccx_candidates_triage.json"}
        )

    # CSV output
    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Target Role", "Experience (Years)", "Source",
        "Triage Status", "AI Fit Score", "AI Recommendation", "AI Summary", "Skills", "Recruiter Notes"
    ])
    for r in rows:
        writer.writerow([
            r["id"],
            r["name"],
            r["target_role"],
            r["years_experience"],
            r["source"],
            r["triage_status"],
            r["ai_fit_score"] or "",
            r["ai_recommendation"] or "",
            r["ai_summary"] or "",
            r["skills"] or "",
            r["recruiter_notes"] or ""
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=gccx_candidates_triage.csv"}
    )


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print("\n=======================================================")
    print(f">> GCCX Candidate Triage Server running on http://127.0.0.1:{port}")
    print("=======================================================\n")
    app.run(host="127.0.0.1", port=port, debug=True)
