"""Task 2 Solutions for GCCX AI Full-Stack Engineer Intern Assessment.

Includes:
- Task 2a: Scalable candidate ranking for 100,000+ candidates using inverted index.
- Task 2b: Bug breakdown and fixed implementations in Python and JavaScript.
"""
from collections import defaultdict
import heapq
from typing import Any, Iterable, Mapping, Sequence


# ==============================================================================
# Task 2a — Candidate Ranking at Scale (100,000+ Candidates)
# ==============================================================================

def normalize_skill(skill: str) -> str:
    """Normalize a skill token: trim whitespace and lowercase."""
    return skill.strip().casefold()


def build_skill_index(candidates: Sequence[Mapping[str, Any]]) -> dict[str, list[int]]:
    """Build an inverted index mapping each distinct skill to candidate indices.
    
    Time Complexity: O(N * K_avg) where N is candidate count and K_avg is average skills per candidate.
    Space Complexity: O(N * K_avg) to store posting lists of candidate indices.
    """
    index = defaultdict(list)
    for idx, candidate in enumerate(candidates):
        # Extract, deduplicate, and normalize skills
        skills = candidate.get("skills", [])
        if not skills:
            continue
        unique_skills = {normalize_skill(s) for s in skills if isinstance(s, str) and s.strip()}
        for skill in unique_skills:
            index[skill].append(idx)
    return dict(index)


def rank_candidates(
    candidates: Sequence[Mapping[str, Any]],
    required_skills: Iterable[str],
    index: Mapping[str, list[int]] | None = None,
    top_k: int | None = None
) -> list[dict[str, Any]]:
    """Rank candidates by descending distinct skill overlap.
    
    Tie-breaking behavior:
    1. Descending score (highest overlap first)
    2. Candidate name alphabetically (case-insensitive)
    3. Candidate ID as unique deterministic fallback
    
    Complexity:
    - With pre-computed index: O(Sum(|posting_list(s)|) for s in required_skills + M log M)
      where M is candidates with >= 1 match (M << N).
    - If top_k is specified: O(Sum + M log K) using a min-heap.
    """
    wanted = {normalize_skill(s) for s in required_skills if isinstance(s, str) and s.strip()}
    if not wanted or not candidates:
        return []

    # Use supplied inverted index or build one on the fly
    skill_index = index if index is not None else build_skill_index(candidates)

    # Accumulate scores only for candidates possessing at least one wanted skill
    scores = defaultdict(int)
    for skill in wanted:
        postings = skill_index.get(skill, [])
        for cand_idx in postings:
            scores[cand_idx] += 1

    if not scores:
        return []

    # Build ranked result list
    if top_k is not None and top_k > 0 and top_k < len(scores):
        # Use heap for top-K queries over large match sets
        # Heap item: (score, negative_lex_name, candidate_dict)
        top_candidates = heapq.nlargest(
            top_k,
            (
                (
                    score,
                    # For reverse tie-breaker in heap
                    candidates[idx].get("name", ""),
                    candidates[idx].get("id", str(idx)),
                    idx
                )
                for idx, score in scores.items()
            ),
            key=lambda x: (x[0], -ord(x[1][0].lower()) if x[1] else 0)
        )
        ranked = [
            {
                "id": candidates[idx].get("id"),
                "name": candidates[idx].get("name", ""),
                "score": score,
                "matched_skills": score
            }
            for score, _, _, idx in top_candidates
        ]
        ranked.sort(key=lambda item: (-item["score"], item["name"].casefold(), str(item["id"])))
        return ranked

    ranked = [
        {
            "id": candidates[idx].get("id"),
            "name": candidates[idx].get("name", ""),
            "score": score,
            "matched_skills": score
        }
        for idx, score in scores.items()
    ]

    # Multi-key deterministic sort: highest score first, then name, then ID
    ranked.sort(key=lambda item: (-item["score"], item["name"].casefold(), str(item["id"])))
    return ranked


def rank_candidates_linear(
    candidates: Sequence[Mapping[str, Any]],
    required_skills: Iterable[str]
) -> list[dict[str, Any]]:
    """Baseline linear scan: checks every candidate one by one.
    
    Used as an algorithmic baseline to benchmark the inverted index.
    Time Complexity: O(N * (K + Q)) on every single query.
    """
    wanted = {normalize_skill(s) for s in required_skills if isinstance(s, str) and s.strip()}
    if not wanted or not candidates:
        return []

    matches = []
    for c in candidates:
        c_skills = {normalize_skill(s) for s in c.get("skills", []) if isinstance(s, str) and s.strip()}
        overlap = len(c_skills & wanted)
        if overlap > 0:
            matches.append({
                "id": c.get("id"),
                "name": c.get("name", ""),
                "score": overlap,
                "matched_skills": overlap
            })

    matches.sort(key=lambda item: (-item["score"], item["name"].casefold(), str(item["id"])))
    return matches


# ==============================================================================
# Task 2b — Review the AI's Work (Bug Breakdown & Fix)
# ==============================================================================

# ORIGINAL BUGGY CODE PROVIDED IN BRIEF:
# function matchCandidates(candidates, requiredSkills) {
#   let matches = [];
#   for (i = 0; i <= candidates.length; i++) {
#     const c = candidates[i];
#     const score = c.skills.filter(s => requiredSkills.includes(s));
#     if (score.length > 0) {
#       matches.push({ name: c.name, score: score });
#     }
#   }
#   return matches.sort((a, b) => a.score - b.score);
# }

def match_candidates_fixed(
    candidates: Sequence[Mapping[str, Any]] | None,
    required_skills: Iterable[str] | None
) -> list[dict[str, Any]]:
    """Corrected, robust implementation of Task 2b.
    
    Fixes applied:
    1. Bound checking: uses proper iterable iteration (no off-by-one).
    2. Variable scope: cleanly scoped local variables.
    3. Score representation: integer count (score = len(overlap)), not an array.
    4. Sorting direction & semantics: sorted descending by score (-score),
       with deterministic alphabetical tie-breaking by name.
    5. Robustness & efficiency: O(1) Set lookups, null safety on candidate & skills.
    """
    if not candidates or not required_skills:
        return []

    wanted = {s.strip().casefold() for s in required_skills if isinstance(s, str) and s.strip()}
    if not wanted:
        return []

    matches = []
    for c in candidates:
        if not isinstance(c, Mapping):
            continue
        raw_skills = c.get("skills")
        if not isinstance(raw_skills, Iterable) or isinstance(raw_skills, (str, bytes)):
            continue

        candidate_skills = {
            s.strip().casefold()
            for s in raw_skills
            if isinstance(s, str) and s.strip()
        }
        score = len(candidate_skills & wanted)
        if score > 0:
            matches.append({
                "name": c.get("name", ""),
                "score": score
            })

    # Sort descending by numerical score; tie-break alphabetically by name
    return sorted(matches, key=lambda item: (-item["score"], item["name"].casefold()))


# JavaScript implementation string of the fix for documentation and tests
MATCH_CANDIDATES_JS_FIXED = """
/**
 * Fixed matchCandidates function (Task 2b).
 * @param {Array<Object>} candidates - List of candidate objects.
 * @param {Array<string>} requiredSkills - Array of required skill strings.
 * @returns {Array<{name: string, score: number}>} - Ranked matching candidates.
 */
function matchCandidatesFixed(candidates, requiredSkills) {
  // Guard against null/undefined or empty inputs
  if (!Array.isArray(candidates) || !Array.isArray(requiredSkills) || candidates.length === 0 || requiredSkills.length === 0) {
    return [];
  }

  // Convert required skills into a lowercase Set for O(1) membership lookups
  const requiredSet = new Set(
    requiredSkills
      .filter(s => typeof s === 'string' && s.trim())
      .map(s => s.trim().toLowerCase())
  );

  if (requiredSet.size === 0) return [];

  const matches = [];

  // Fix 1 & 2: Use "for (const c of candidates)" to prevent off-by-one boundary
  // errors and ensure no undeclared index variable leaks into global scope.
  for (const c of candidates) {
    if (!c || !Array.isArray(c.skills)) continue;

    // Deduplicate candidate skills using Set to avoid artificial duplicate counts
    const candidateSkillsSet = new Set(
      c.skills
        .filter(s => typeof s === 'string' && s.trim())
        .map(s => s.trim().toLowerCase())
    );

    // Fix 3: Count matching skills as a numerical integer
    let matchCount = 0;
    for (const skill of candidateSkillsSet) {
      if (requiredSet.has(skill)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      matches.push({
        name: c.name || '',
        score: matchCount // Fix 3: numerical score, not array
      });
    }
  }

  // Fix 4: Sort DESCENDING (b.score - a.score) for highest match first,
  // with deterministic tie-breaking alphabetically by candidate name.
  return matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}
"""

TASK2B_EXPLANATION = """
What a developer who didn't read the AI's output would have missed:

A developer who casually skimmed the AI-generated code would see familiar JavaScript idioms (.filter, .includes, .sort) and assume it worked, completely missing that it crashes in production on the very last loop iteration due to an off-by-one boundary (i <= candidates.length accessing undefined.skills). Furthermore, omitting 'let' leaks 'i' into global scope, pushing 'score: score' stores an array of strings instead of a number, and calling 'a.score - b.score' attempts arithmetic subtraction on arrays—yielding NaN and leaving candidate results unsorted or corrupted in ascending order.
"""
