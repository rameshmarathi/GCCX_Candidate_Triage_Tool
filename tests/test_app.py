"""Comprehensive test suite for GCCX Candidate Triage Tool Backend API & Persistence."""
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

import app as candidate_app


@pytest.fixture()
def client(monkeypatch):
    """Create an isolated test client with a temporary SQLite database."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(path)
    monkeypatch.setattr(candidate_app, "DB_PATH", db_path)

    # Initialize fresh database and seed mock data
    candidate_app.init_db()
    candidate_app.app.config.update(TESTING=True)

    with candidate_app.app.test_client() as test_client:
        yield test_client

    if db_path.exists():
        db_path.unlink()


# ==============================================================================
# Health & Seeding Tests
# ==============================================================================

def test_health(client):
    """Verify health check endpoint returns 200, db status, and candidate count."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["database"] == "sqlite"
    assert data["candidate_count"] == 48


def test_database_idempotent_seeding(client, monkeypatch):
    """Verify re-running init_db preserves existing shortlists, tags, and AI summaries."""
    # 1. Modify a candidate
    patch_res = client.patch(
        "/api/candidates/cand_001",
        json={"shortlisted": True, "tags": ["Preserved Tag", "Priority"]}
    )
    assert patch_res.status_code == 200

    # 2. Re-trigger init_db (simulating server restart)
    candidate_app.init_db()

    # 3. Verify modifications are still intact and count remains exactly 48
    get_res = client.get("/api/candidates/cand_001")
    cand = get_res.get_json()["candidate"]
    assert cand["shortlisted"] is True
    assert "Preserved Tag" in cand["tags"]

    health_res = client.get("/api/health")
    assert health_res.get_json()["candidate_count"] == 48


# ==============================================================================
# Search & Filter Tests
# ==============================================================================

def test_search_by_name(client):
    """Search by candidate name returns exact match."""
    res = client.get("/api/candidates?q=Sameer")
    data = res.get_json()
    assert res.status_code == 200
    assert data["total"] == 1
    assert data["candidates"][0]["name"] == "Sameer Rao"


def test_search_by_skill_in_free_text(client):
    """Search query 'q' finds candidates possessing the skill in their skills_json."""
    res = client.get("/api/candidates?q=FastAPI")
    data = res.get_json()
    assert res.status_code == 200
    assert data["total"] >= 1
    assert any("FastAPI" in c["skills"] for c in data["candidates"])


def test_filter_by_target_role(client):
    """Filter by exact target role."""
    res = client.get("/api/candidates?role=ML Engineer")
    data = res.get_json()
    assert res.status_code == 200
    assert data["total"] > 0
    assert all(c["target_role"] == "ML Engineer" for c in data["candidates"])


def test_filter_by_source(client):
    """Filter by recruiting source."""
    res = client.get("/api/candidates?source=Referral")
    data = res.get_json()
    assert res.status_code == 200
    assert data["total"] > 0
    assert all(c["source"] == "Referral" for c in data["candidates"])


def test_filter_by_experience_range(client):
    """Filter by minimum and maximum years of experience."""
    res = client.get("/api/candidates?min_exp=3&max_exp=5")
    data = res.get_json()
    assert res.status_code == 200
    assert data["total"] > 0
    assert all(3 <= c["years_experience"] <= 5 for c in data["candidates"])


def test_filter_by_shortlist_status(client):
    """Filter explicitly by shortlisted boolean."""
    # Ensure cand_002 is shortlisted
    client.patch("/api/candidates/cand_002", json={"shortlisted": True})

    res = client.get("/api/candidates?shortlisted=true")
    data = res.get_json()
    assert res.status_code == 200
    assert all(c["shortlisted"] is True for c in data["candidates"])
    assert any(c["id"] == "cand_002" for c in data["candidates"])


def test_sorting_options(client):
    """Verify sorting by experience descending and name ascending."""
    res_desc = client.get("/api/candidates?sort=experience_desc")
    cands_desc = res_desc.get_json()["candidates"]
    exps = [c["years_experience"] for c in cands_desc]
    assert exps == sorted(exps, reverse=True)

    res_name = client.get("/api/candidates?sort=name_asc")
    cands_name = res_name.get_json()["candidates"]
    names = [c["name"].casefold() for c in cands_name]
    assert names == sorted(names)


# ==============================================================================
# Single Candidate & Update Tests
# ==============================================================================

def test_get_candidate_by_id(client):
    """Retrieve single candidate by ID."""
    res = client.get("/api/candidates/cand_001")
    assert res.status_code == 200
    candidate = res.get_json()["candidate"]
    assert candidate["id"] == "cand_001"
    assert candidate["name"] == "Sameer Rao"
    assert isinstance(candidate["skills"], list)


def test_get_candidate_not_found(client):
    """Requesting non-existent candidate ID returns 404."""
    res = client.get("/api/candidates/non_existent_999")
    assert res.status_code == 404
    assert "not found" in res.get_json()["error"].lower()


def test_patch_shortlist_and_tags(client):
    """Update shortlist status and custom tags."""
    # Add tags
    res = client.patch(
        "/api/candidates/cand_001",
        json={"shortlisted": True, "tags": ["Strong Java", "Follow-up", "Strong Java"]}
    )
    assert res.status_code == 200
    cand = res.get_json()["candidate"]
    assert cand["shortlisted"] is True
    # Deduplication check
    assert cand["tags"] == ["Strong Java", "Follow-up"]

    # Remove a tag
    res_remove = client.patch(
        "/api/candidates/cand_001",
        json={"tags": ["Strong Java"]}
    )
    assert res_remove.status_code == 200
    assert res_remove.get_json()["candidate"]["tags"] == ["Strong Java"]


def test_patch_validation_errors(client):
    """Verify 400 bad request on invalid payload types."""
    # Non-dictionary payload
    res1 = client.patch("/api/candidates/cand_001", data="invalid string", content_type="application/json")
    assert res1.status_code == 400

    # Non-boolean shortlisted
    res2 = client.patch("/api/candidates/cand_001", json={"shortlisted": "yes"})
    assert res2.status_code == 400

    # Non-list tags
    res3 = client.patch("/api/candidates/cand_001", json={"tags": "single-tag"})
    assert res3.status_code == 400

    # Empty payload
    res4 = client.patch("/api/candidates/cand_001", json={})
    assert res4.status_code == 400


# ==============================================================================
# Real AI Integration Endpoint Tests
# ==============================================================================

def test_ai_summary_missing_key_returns_503(client, monkeypatch):
    """Without an OPENAI_API_KEY, the endpoint returns a clear 503 error."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    res = client.post("/api/candidates/cand_001/summary")
    assert res.status_code == 503
    assert "OPENAI_API_KEY is not configured" in res.get_json()["error"]


def test_ai_summary_candidate_not_found(client, monkeypatch):
    """Valid key but non-existent candidate returns 404."""
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-test-key")
    res = client.post("/api/candidates/cand_999/summary")
    assert res.status_code == 404


def test_ai_summary_mocked_success(client, monkeypatch):
    """When OpenAI responds, the summary is saved to SQLite and returned."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key-for-test")
    mock_summary_text = "Experienced in enterprise Java and Kubernetes; ownership in large team requires probing."

    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = mock_summary_text
    mock_response.choices = [mock_choice]

    with patch("app.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_cls.return_value = mock_client

        res = client.post("/api/candidates/cand_001/summary")
        assert res.status_code == 200
        data = res.get_json()
        assert data["summary"] == mock_summary_text
        assert data["candidate_id"] == "cand_001"
        assert "model" in data

    # Verify summary persisted in SQLite
    get_res = client.get("/api/candidates/cand_001")
    assert get_res.get_json()["candidate"]["ai_summary"] == mock_summary_text
