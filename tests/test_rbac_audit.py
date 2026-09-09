"""Security-audit coverage: isolation, forged roles, assignment immutability."""
from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.api.main import app
from app.auth import get_current_user, init_db
from app.auth.database import create_user, list_assignments
from app.auth.security import create_access_token, hash_password

from .test_api_endpoints import StubRepository
from .test_rbac_authorization import ADMIN, CREATE_PAYLOAD, INVESTIGATOR, METADATA, api_client


UNASSIGNED_CASE_PATHS = (
    "/cases/CASE-B/overview",
    "/cases/CASE-B/nodes/top",
    "/cases/CASE-B/nodes/N1",
    "/cases/CASE-B/graph",
    "/cases/CASE-B/communities",
    "/cases/CASE-B/communities/1",
    "/cases/CASE-B/path?from_node_id=N1&to_node_id=N2",
    "/cases/CASE-B/criticality",
    "/cases/CASE-B/nodes/N1/suggested_links",
)

ARCHIVED_CASE_PATHS = (
    "/cases/CASE-ARCHIVED/overview",
    "/cases/CASE-ARCHIVED/nodes/top",
    "/cases/CASE-ARCHIVED/graph",
    "/cases/CASE-ARCHIVED/communities",
    "/cases/CASE-ARCHIVED/criticality",
)


class ListingRepository(StubRepository):
    def list_cases(self, case_filter, sort, allowed_case_ids=None):
        rows = [
            {
                "case_id": "CASE-A",
                "name": "Alpha",
                "status": "ACTIVE",
                "priority": None,
                "description": None,
                "node_count": 2,
                "edge_count": 1,
                "updated_at": None,
                "lead_analyst": None,
                "jurisdiction_tag": None,
            },
            {
                "case_id": "CASE-B",
                "name": "Bravo",
                "status": "ACTIVE",
                "priority": None,
                "description": None,
                "node_count": 1,
                "edge_count": 0,
                "updated_at": None,
                "lead_analyst": None,
                "jurisdiction_tag": None,
            },
            {
                "case_id": "CASE-ARCHIVED",
                "name": "Old",
                "status": "ARCHIVED",
                "priority": None,
                "description": None,
                "node_count": 1,
                "edge_count": 0,
                "updated_at": None,
                "lead_analyst": None,
                "jurisdiction_tag": None,
            },
        ]
        if allowed_case_ids is not None:
            rows = [row for row in rows if row["case_id"] in set(allowed_case_ids)]
        if case_filter == "active":
            rows = [row for row in rows if (row.get("status") or "").upper() == "ACTIVE"]
        elif case_filter == "archived":
            rows = [row for row in rows if (row.get("status") or "").upper() == "ARCHIVED"]
        return rows


class PurgeRepository(StubRepository):
    def get_case(self, case_id):
        if case_id not in self.known_ids:
            return None
        return super().get_case(case_id)

    def purge_archived_case(self, case_id):
        deleted = super().purge_archived_case(case_id)
        if deleted:
            self.known_ids.discard(case_id)
        return deleted


@contextmanager
def listing_client(user, *, assigned_case_ids=None):
    assigned = list(assigned_case_ids or [])
    repository = ListingRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_current_user] = lambda: user

    def _has_assignment(case_id, username):
        return case_id in assigned and username == user["username"]

    try:
        with patch("app.api.main.assigned_case_ids", return_value=assigned):
            with patch("app.api.dependencies.has_assignment", side_effect=_has_assignment):
                with TestClient(app) as api:
                    yield api
    finally:
        app.dependency_overrides.clear()


def test_investigator_case_list_hides_unassigned_and_archived():
    with listing_client(INVESTIGATOR, assigned_case_ids=["CASE-A", "CASE-ARCHIVED"]) as api:
        visible = {row["case_id"] for row in api.get("/cases").json()}
        assert visible == {"CASE-A"}
        archived = {row["case_id"] for row in api.get("/cases?filter=archived").json()}
        assert archived == {"CASE-A"}


def test_admin_case_list_includes_unassigned_and_archived():
    with listing_client(ADMIN) as api:
        visible = {row["case_id"] for row in api.get("/cases").json()}
        assert visible == {"CASE-A", "CASE-B", "CASE-ARCHIVED"}


def test_investigator_cannot_read_unassigned_case_secondary_endpoints():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        for path in UNASSIGNED_CASE_PATHS:
            assert api.get(path).status_code == 404, path
        assigned_ok = (
            "/cases/CASE-A/overview",
            "/cases/CASE-A/nodes/top",
            "/cases/CASE-A/graph",
            "/cases/CASE-A/communities",
            "/cases/CASE-A/path?from_node_id=N1&to_node_id=N2",
            "/cases/CASE-A/criticality",
        )
        for path in assigned_ok:
            assert api.get(path).status_code == 200, path


def test_investigator_cannot_read_archived_case_even_if_assigned():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-ARCHIVED"}) as api:
        for path in ARCHIVED_CASE_PATHS:
            assert api.get(path).status_code == 404, path


def test_investigator_cannot_restore_or_mutate_admin_case_endpoints():
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.post("/cases/CASE-A/restore").status_code == 403
        assert api.post("/cases", json=CREATE_PAYLOAD).status_code == 403
        assert api.patch("/cases/CASE-A", json=METADATA).status_code == 403
        assert api.delete("/cases/CASE-A").status_code == 403


def test_investigator_assignment_attempts_do_not_change_state(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    create_user("inv1", "unused-hash", "investigator")
    create_user("inv2", "unused-hash", "investigator")
    with api_client(ADMIN) as api:
        assert api.put("/cases/CASE-A/assignments/inv1").status_code == 200
        before = api.get("/cases/CASE-A/assignments").json()
        assert [row["username"] for row in before] == ["inv1"]
    with api_client(INVESTIGATOR, assigned_case_ids={"CASE-A"}) as api:
        assert api.put("/cases/CASE-A/assignments/inv1").status_code == 403
        assert api.put("/cases/CASE-A/assignments/inv2").status_code == 403
        assert api.put("/cases/CASE-B/assignments/inv1").status_code == 403
        assert api.delete("/cases/CASE-A/assignments/inv1").status_code == 403
        assert api.delete("/cases/CASE-A/assignments/inv2").status_code == 403
    assert [row["username"] for row in list_assignments("CASE-A")] == ["inv1"]
    assert list_assignments("CASE-B") == []


def test_purged_case_cannot_be_read_or_reassigned():
    repository = PurgeRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_current_user] = lambda: ADMIN
    try:
        with TestClient(app) as api:
            assert api.delete("/cases/CASE-ARCHIVED").status_code == 204
            assert api.get("/cases/CASE-ARCHIVED/overview").status_code == 404
            assert api.get("/cases/CASE-ARCHIVED/assignments").status_code == 404
            assert api.put("/cases/CASE-ARCHIVED/assignments/inv1").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_jwt_role_claim_cannot_elevate_and_me_uses_database_role(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    monkeypatch.setenv("AUTH_SECRET_KEY", "audit-secret-key-for-tests")
    init_db()
    create_user("inv1", hash_password("secret"), "investigator")
    forged = create_access_token(username="inv1", role="admin")
    app.dependency_overrides.clear()
    with TestClient(app) as api:
        me = api.get("/me", headers={"Authorization": f"Bearer {forged}"})
        assert me.status_code == 200
        assert me.json() == {"username": "inv1", "role": "investigator"}
        assert api.get("/users", headers={"Authorization": f"Bearer {forged}"}).status_code == 403
        assert api.post(
            "/register",
            json={"username": "other", "password": "secret", "role": "admin"},
            headers={"Authorization": f"Bearer {forged}"},
        ).status_code == 403


def test_login_ignores_client_supplied_role_and_hides_password(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    monkeypatch.setenv("AUTH_SECRET_KEY", "audit-secret-key-for-tests")
    init_db()
    create_user("inv1", hash_password("secret"), "investigator")
    app.dependency_overrides.clear()
    with TestClient(app) as api:
        response = api.post("/login", json={"username": "inv1", "password": "secret", "role": "admin"})
        assert response.status_code == 200
        body = response.json()
        assert body["role"] == "investigator"
        assert body["username"] == "inv1"
        assert "password" not in body
        assert "password_hash" not in body


def test_admin_user_creation_rules(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    init_db()
    with api_client(ADMIN) as api:
        created = api.post("/register", json={"username": "  lead  ", "password": "secret", "role": "admin"})
        assert created.status_code == 200
        assert created.json() == {"username": "lead", "role": "admin"}
        assert "password" not in created.json()
        duplicate = api.post("/register", json={"username": "lead", "password": "secret", "role": "investigator"})
        assert duplicate.status_code == 400
        blank = api.post("/register", json={"username": "   ", "password": "secret", "role": "investigator"})
        assert blank.status_code == 422
        listed = api.get("/users").json()
        assert {"username": "lead", "role": "admin"} in listed
        assert all("password" not in row and "password_hash" not in row for row in listed)
