#!/usr/bin/env python3
"""
Entry point to launch the GCCX Candidate Triage application.
"""
import os
import sys

# Ensure current directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, init_db

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "="*60)
    print(">> GCCX CANDIDATE TRIAGE APPLICATION")
    print(f">> Local URL: http://127.0.0.1:{port}")
    print(">> Database: SQLite (candidates.db)")
    print(">> Dataset: candidates.json (48 records)")
    print("="*60 + "\n")
    app.run(host="127.0.0.1", port=port, debug=False)
