"""Unit tests for Task 2 coding problems: Task 2a (Ranking at scale) & Task 2b (Bug review)."""
import pytest
from task2_solutions import (
    build_skill_index,
    rank_candidates,
    rank_candidates_linear,
    match_candidates_fixed,
    MATCH_CANDIDATES_JS_FIXED
)


# ==============================================================================
# Task 2a — Candidate Ranking at Scale Tests
# ==============================================================================

@pytest.fixture()
def sample_candidates():
    return [
        {"id": "cand_1", "name": "Aarav Sharma", "skills": ["Python", "FastAPI", "Docker", "PostgreSQL"]},
        {"id": "cand_2", "name": "Ben Cohen", "skills": ["Python", "Docker"]},
        {"id": "cand_3", "name": "Catherine Zeta", "skills": ["React", "TypeScript", "Node.js"]},
        {"id": "cand_4", "name": "Deepak Verma", "skills": ["Python", "FastAPI", "Docker"]},
        {"id": "cand_5", "name": "Ananya Sharma", "skills": ["Python", "FastAPI", "Docker", "PostgreSQL"]},
    ]


def test_task2a_build_skill_index(sample_candidates):
    """Verify inverted index maps each normalized skill to candidate positions."""
    index = build_skill_index(sample_candidates)
    assert isinstance(index, dict)
    assert "python" in index
    # Python is in candidates 0, 1, 3, 4
    assert set(index["python"]) == {0, 1, 3, 4}
    assert set(index["react"]) == {2}
    assert "ruby" not in index


def test_task2a_rank_candidates_scoring(sample_candidates):
    """Rank candidates with required skills: ['Python', 'FastAPI', 'Docker', 'PostgreSQL']."""
    req = ["Python", "FastAPI", "Docker", "PostgreSQL"]
    ranked = rank_candidates(sample_candidates, req)

    assert len(ranked) == 4  # Catherine Zeta has 0 overlap, should not be included
    # Top candidates have score 4 (Aarav and Ananya)
    assert ranked[0]["score"] == 4
    assert ranked[1]["score"] == 4
    # Tie-break check: "Ananya Sharma" comes before "Aarav Sharma" alphabetically
    assert ranked[0]["name"] == "Aarav Sharma" or ranked[0]["name"] == "Ananya Sharma"
    names_score_4 = [ranked[0]["name"], ranked[1]["name"]]
    assert names_score_4 == sorted(names_score_4)

    # Next is Deepak Verma with score 3
    assert ranked[2]["name"] == "Deepak Verma"
    assert ranked[2]["score"] == 3

    # Next is Ben Cohen with score 2
    assert ranked[3]["name"] == "Ben Cohen"
    assert ranked[3]["score"] == 2


def test_task2a_deterministic_tie_breaking():
    """Verify tie-breaking: identical scores sorted by name (casefolded), then ID."""
    candidates = [
        {"id": "cand_z", "name": "Zack", "skills": ["Python"]},
        {"id": "cand_b", "name": "bob", "skills": ["Python"]},
        {"id": "cand_a2", "name": "Alice", "skills": ["Python"]},
        {"id": "cand_a1", "name": "Alice", "skills": ["Python"]},
    ]
    ranked = rank_candidates(candidates, ["Python"])
    assert len(ranked) == 4
    # All have score 1
    assert all(r["score"] == 1 for r in ranked)
    # Alphabetical by name: Alice, Alice, bob, Zack
    names = [r["name"].lower() for r in ranked]
    assert names == ["alice", "alice", "bob", "zack"]
    # Final tie-breaker by ID: cand_a1 comes before cand_a2
    assert ranked[0]["id"] == "cand_a1"
    assert ranked[1]["id"] == "cand_a2"


def test_task2a_empty_and_disjoint_inputs(sample_candidates):
    """Empty candidate corpus, empty skills, or disjoint skills return empty list."""
    assert rank_candidates([], ["Python"]) == []
    assert rank_candidates(sample_candidates, []) == []
    assert rank_candidates(sample_candidates, ["Rust", "Haskell"]) == []


def test_task2a_linear_matches_inverted_index(sample_candidates):
    """Verify that inverted index and linear scan produce identical ranked outputs."""
    req = ["Python", "Docker", "Kubernetes", "AWS"]
    idx = build_skill_index(sample_candidates)

    from_index = rank_candidates(sample_candidates, req, index=idx)
    from_linear = rank_candidates_linear(sample_candidates, req)

    assert from_index == from_linear


# ==============================================================================
# Task 2b — Review the AI's Work (Bug Fix Verification)
# ==============================================================================

def test_task2b_empty_inputs():
    """Test Case 1: Empty inputs return empty array without error."""
    assert match_candidates_fixed([], ["Python"]) == []
    assert match_candidates_fixed([{"name": "Alice", "skills": ["Python"]}], []) == []
    assert match_candidates_fixed([], []) == []
    assert match_candidates_fixed(None, ["Python"]) == []
    assert match_candidates_fixed([{"name": "Alice"}], None) == []


def test_task2b_no_matches():
    """Test Case 2: Candidates present, but none share skills with requiredSkills."""
    candidates = [
        {"name": "Alice", "skills": ["Java", "Spring Boot"]},
        {"name": "Bob", "skills": ["C++", "Qt"]},
    ]
    assert match_candidates_fixed(candidates, ["Python", "FastAPI"]) == []


def test_task2b_multiple_matches():
    """Test Case 3: Multiple candidates with varying matches, sorted descending by score."""
    candidates = [
        {"name": "Charlie", "skills": ["Python"]},                           # 1 match
        {"name": "Alice", "skills": ["Python", "FastAPI", "PostgreSQL"]},    # 3 matches
        {"name": "Bob", "skills": ["Python", "FastAPI"]},                    # 2 matches
    ]
    ranked = match_candidates_fixed(candidates, ["Python", "FastAPI", "PostgreSQL"])

    assert len(ranked) == 3
    # Descending order by score: Alice (3), Bob (2), Charlie (1)
    assert ranked[0] == {"name": "Alice", "score": 3}
    assert ranked[1] == {"name": "Bob", "score": 2}
    assert ranked[2] == {"name": "Charlie", "score": 1}


def test_task2b_ties():
    """Test Case 4: Multiple candidates with identical scores, sorted deterministically by name."""
    candidates = [
        {"name": "Zara", "skills": ["Python", "SQL"]},
        {"name": "Alice", "skills": ["Python", "SQL"]},
        {"name": "Bob", "skills": ["Python", "SQL"]},
    ]
    ranked = match_candidates_fixed(candidates, ["Python", "SQL"])

    assert len(ranked) == 3
    assert all(r["score"] == 2 for r in ranked)
    # Must be sorted alphabetically: Alice, Bob, Zara
    names = [r["name"] for r in ranked]
    assert names == ["Alice", "Bob", "Zara"]


def test_task2b_null_and_malformed_skills_safety():
    """Robustness test: handles candidates with missing skills, non-list skills, or whitespace."""
    candidates = [
        {"name": "Valid", "skills": ["  Python  ", "Docker"]},
        {"name": "MissingSkills"},
        {"name": "NullSkills", "skills": None},
        {"name": "EmptySkills", "skills": []},
        {"name": "DuplicateSkills", "skills": ["Python", "Python", "PYTHON"]},
    ]
    ranked = match_candidates_fixed(candidates, ["python"])

    assert len(ranked) == 2
    names = [r["name"] for r in ranked]
    assert "Valid" in names
    assert "DuplicateSkills" in names

    # Duplicate skills should only be counted once per required skill
    dup_cand = next(r for r in ranked if r["name"] == "DuplicateSkills")
    assert dup_cand["score"] == 1


def test_task2b_reproduce_buggy_code_crash():
    """Demonstrate the exact failure in the AI's original code: off-by-one boundary crash."""
    def buggy_match_candidates(candidates, required_skills):
        matches = []
        # Replicating JS: for (i = 0; i <= candidates.length; i++)
        for i in range(len(candidates) + 1):
            if i >= len(candidates):
                # In JS, candidates[i] is undefined, accessing c.skills throws TypeError
                raise TypeError("Cannot read properties of undefined (reading 'skills')")
            c = candidates[i]
            score = [s for s in c["skills"] if s in required_skills]
            if len(score) > 0:
                matches.append({"name": c["name"], "score": score})
        return matches

    candidates = [{"name": "Sameer", "skills": ["Java"]}]
    with pytest.raises(TypeError, match="Cannot read properties of undefined"):
        buggy_match_candidates(candidates, ["Java"])
