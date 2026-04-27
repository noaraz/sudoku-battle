"""Tests for app/core/config.py — Settings validation and env var loading."""

from app.core.config import Settings, get_settings


def test_firestore_database_defaults_to_default():
    s = Settings(gcp_project_id="test-proj")
    assert s.firestore_database == "(default)"


def test_firestore_database_reads_from_env(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("FIRESTORE_DATABASE", "pr-42")
    s = get_settings()
    assert s.firestore_database == "pr-42"
    get_settings.cache_clear()
