"""Backend RBAC: admin vs investigator authorization on existing endpoints."""
from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.api.main import app
from app.auth import get_current_user, init_db
from app.auth.database import create_user

from .test_api_endpoints import StubRepository


ADMIN = {"username": "admin", "role": "admin"}
INVESTIGATOR = {"username": "inv1", "role": "investigator"}
METADATA = {
    "name": "Operation Blackthorn II",
    "priority": "I",
    "description": "Updated summary",
    "jurisdiction_tag": "FINANCIAL CRIMES",
}


CREATE_PAYLOAD = {
    "case_name": "Operation Silverline",
    "priority": "II",
    "jurisdiction": "CYBER-INTEL",
    "summary": "Empty docket",
}


@contextmanager
def api_client(user, *, assigned_case_ids=None):
    assigned = set(assigned_case_ids or [])
    repository = StubRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_current_user] = lambda: user

    def _has_assignment(case_id, username):
        return case_id in assigned and username == user["username"]

    try:
        with patch("app.api.dependencies.has_assignment", side_effect=_has_assignment):
            with TestClient(app) as api:
                yield api
    finally:
        app.dependency_overrides.clear()


def test_investigator_cannot_patch_case_metadata():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        response = api.patch("/cases/CASE-A", json=METADATA)
        assert response.status_code == 403


def test_admin_can_patch_case_metadata():
    with api_client(ADMIN) as api:
        response = api.patch("/cases/CASE-A", json=METADATA)
        assert response.status_code == 200
        assert response.json()["name"] == METADATA["name"]


def test_investigator_cannot_delete_case():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.delete("/cases/CASE-A").status_code == 403
        assert api.delete("/cases/CASE-ARCHIVED").status_code == 403


def test_admin_delete_follows_archive_rules():
    with api_client(ADMIN) as api:
        assert api.delete("/cases/CASE-A").status_code == 409
        assert api.delete("/cases/CASE-ARCHIVED").status_code == 204
        assert api.delete("/cases/MISSING").status_code == 404


def test_investigator_cannot_archive_case():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.post("/cases/CASE-A/archive").status_code == 403


def test_admin_can_archive_case():
    with api_client(ADMIN) as api:
        response = api.post("/cases/CASE-A/archive")
        assert response.status_code == 200
        assert response.json() == {"case_id": "CASE-A", "status": "ARCHIVED"}


def test_investigator_cannot_use_assignment_api():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.get("/cases/CASE-A/assignments").status_code == 403
        assert api.put("/cases/CASE-A/assignments/inv1").status_code == 403
        assert api.delete("/cases/CASE-A/assignments/inv1").status_code == 403


def test_admin_can_use_assignment_api(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    create_user("inv1", "unused-hash", "investigator")
    with api_client(ADMIN) as api:
        listed = api.get("/cases/CASE-A/assignments")
        assert listed.status_code == 200
        assigned = api.put("/cases/CASE-A/assignments/inv1")
        assert assigned.status_code == 200
        assert assigned.json()[0]["username"] == "inv1"
        assert api.delete("/cases/CASE-A/assignments/inv1").status_code == 204


def test_investigator_can_get_assigned_case():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        response = api.get("/cases/CASE-A/overview")
        assert response.status_code == 200
        assert response.json()["case_id"] == "CASE-A"


def test_investigator_cannot_get_unassigned_case():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.get("/cases/CASE-B/overview").status_code == 404


def test_admin_can_get_any_case():
    with api_client(ADMIN) as api:
        assigned = api.get("/cases/CASE-A/overview")
        other = api.get("/cases/CASE-B/overview")
        assert assigned.status_code == 200
        assert other.status_code == 200
        assert other.json()["case_id"] == "CASE-B"


def test_investigator_cannot_create_case():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.post("/cases", json=CREATE_PAYLOAD).status_code == 403


def test_admin_create_case_is_allowed():
    with api_client(ADMIN) as api:
        response = api.post("/cases", json=CREATE_PAYLOAD)
        assert response.status_code == 201
        assert response.json()["status"] == "ACTIVE"


def test_admin_can_list_and_create_users(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    with api_client(ADMIN) as api:
        created = api.post("/register", json={"username": "inv1", "password": "secret", "role": "investigator"})
        assert created.status_code == 200
        listed = api.get("/users")
        assert listed.status_code == 200
        assert {"username": "inv1", "role": "investigator"} in listed.json()


def test_investigator_cannot_manage_users(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    create_user("inv1", "unused-hash", "investigator")
    with api_client(INVESTIGATOR) as api:
        assert api.get("/users").status_code == 403
        assert api.post("/register", json={"username": "other", "password": "secret", "role": "investigator"}).status_code == 403


def test_investigator_cannot_assign_themselves_or_another_user(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    create_user("inv1", "unused-hash", "investigator")
    create_user("inv2", "unused-hash", "investigator")
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.put("/cases/CASE-A/assignments/inv1").status_code == 403
        assert api.put("/cases/CASE-A/assignments/inv2").status_code == 403
        assert api.delete("/cases/CASE-A/assignments/inv1").status_code == 403


def test_unauthenticated_cannot_create_case():
    app.dependency_overrides.clear()
    with TestClient(app) as api:
        missing = api.post("/cases", json=CREATE_PAYLOAD)
        assert missing.status_code in {401, 403}
        invalid = api.post(
            "/cases",
            json=CREATE_PAYLOAD,
            headers={"Authorization": "Bearer not-a-valid-token"},
        )
        assert invalid.status_code == 401
