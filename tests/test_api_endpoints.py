<<<<<<< HEAD
import httpx
=======
from datetime import datetime, timezone
>>>>>>> origin/main

from fastapi.testclient import TestClient

from app.api.case_ids import allocate_case_id
from app.api.dependencies import get_repository
from app.api.main import app
from app.auth import get_current_user


class StubRepository:
    def __init__(self):
        self.created_cases = []
        self.known_ids = {"CASE-A", "CASE-B", "CASE-ARCHIVED"}

    def get_case(self, case_id):
        if case_id == "CASE-ARCHIVED":
            return {"case_id": case_id, "status": "ARCHIVED"}
        if case_id in self.known_ids:
            return {"case_id": case_id, "status": "ACTIVE"}
        return None

    def create_case(self, name, priority, description, jurisdiction_tag, lead_analyst, updated_at):
        case_id = allocate_case_id(self.known_ids, datetime.now(timezone.utc))
        self.known_ids.add(case_id)
        row = {
            "case_id": case_id,
            "name": name,
            "status": "ACTIVE",
            "priority": priority,
            "description": description,
            "node_count": 0,
            "edge_count": 0,
            "updated_at": updated_at,
            "lead_analyst": lead_analyst,
            "jurisdiction_tag": jurisdiction_tag,
        }
        self.created_cases.append(row)
        return row

    def set_case_status(self, case_id, status):
        if self.get_case(case_id) is None:
            return None
        return {"case_id": case_id, "status": status}

    def purge_archived_case(self, case_id):
        case = self.get_case(case_id)
        if case is None:
            return False
        if (case.get("status") or "").upper() != "ARCHIVED":
            raise ValueError("case must be archived before purging")
        return True
    def list_cases(self, case_filter, sort, allowed_case_ids=None):
        existing = [{"case_id": "CASE-A", "name": "Alpha", "status": "ACTIVE", "priority": None, "description": None, "node_count": 2, "edge_count": 1, "updated_at": None, "lead_analyst": None, "jurisdiction_tag": None}]
        return self.created_cases + existing
        self.status = "ACTIVE"

    def get_case(self, case_id):
        return {"case_id": case_id, "status": self.status}
    def list_cases(self, case_filter, sort, allowed_case_ids=None, allowed_statuses=None):
        return [{"case_id": "CASE-A", "name": "Alpha", "status": self.status, "priority": None, "description": None, "node_count": 2, "edge_count": 1, "updated_at": None, "lead_analyst": None, "jurisdiction_tag": None}]
    def set_case_status(self, case_id, status):
        self.status = status
        return {"case_id": case_id, "status": status}
    def purge_completed_case(self, case_id):
        if self.status != "COMPLETED":
            raise ValueError("case must be completed before purging")
        return True
    def get_case_overview(self, case_id):
        return {"case_id": case_id, "total_entities": 2, "total_relationships": 1, "community_count": 1, "modularity": 0.5, "structural_alert_count": 0, "direct_1hop_count": 1}
    def get_top_nodes(self, case_id, metric_property, limit):
        return [{"node_id": "N1", "name": "One", "entity_type": None, "score": .9, "rank": 1}]
    def get_node_detail(self, case_id, node_id):
        return {"node_id": node_id, "name": "One", "entity_type": None, "first_contact_date": None, "scores": {"betweenness": .9, "eigenvector": .8, "degree": 2}, "community_id": "1", "structural_role": "HUB", "connection_count": 1, "structural_alert_count": 0, "ego_network": {"nodes": ["N1", "N2"], "edges": [{"source": "N1", "target": "N2", "type": "CALLED"}]}}
    def get_case_graph(self, case_id, bridging_only, cutoff):
        return {"nodes": [{"node_id": "N1", "name": "One", "entity_type": None, "betweenness": .9, "degree": 2, "eigenvector": .8, "community_id": "1", "structural_role": "HUB"}], "edges": [], "metrics": {"density": .5, "diameter": 1, "reciprocity": 0}}
    def get_communities(self, case_id):
        return [{"community_id": "1", "label": "Cluster 1", "size": 2, "internal_density": 1, "external_density": 0, "member_node_ids": ["N1", "N2"]}]
    def get_community_detail(self, case_id, community_id):
        return {"community_id": community_id, "size": 2, "internal_density": 1, "external_density": 0, "members": [{"node_id": "N1", "name": "One", "entity_type": None, "centrality": .9}]}
    def get_case_summary(self, case_id):
        return {"case_id": case_id, "summary_text": "Stored case summary.", "source": "template", "generated_at": "2026-09-10T00:00:00+00:00"}
    def get_community_summary(self, case_id, community_id):
        return {"community_id": community_id, "summary_text": "Stored community summary.", "source": "llm", "generated_at": "2026-09-10T00:00:00+00:00"}
    def get_community_summaries(self, case_id):
        return [self.get_community_summary(case_id, "1")]
    def find_path(self, case_id, from_node_id, to_node_id):
        return {"path_found": True, "hops": 1, "connection_strength": .5, "total_relationship_count": 1, "nodes": [from_node_id, to_node_id], "steps": [{"step": 1, "from": "One", "to": "Two", "relationship_type": "CALLED", "detail": "CALLED (weight 1)"}]}
    def get_criticality(self, case_id, top_k):
        return {"case_id": case_id, "initial_node_count": 2, "criterion": "largest_component_fragmentation", "ranked_removals": [{"rank": 1, "node_id": "N1", "node_name": "One", "entity_type_label": "CRITICAL CUT", "component_size_before": 2, "component_size_after": 1, "fragmentation_pct": 50}], "final_state": {"components_created": 1, "largest_remaining_component": 1, "overall_efficiency_drop_pct": 50}, "note": None}
    def get_suggested_links(self, case_id, node_id):
        return [{"suggested_node_id": "N2", "suggested_name": "Two", "similarity_score": .61}]
    def update_case_metadata(self, case_id, name, priority, description, jurisdiction_tag, updated_at):
        if case_id != "CASE-A":
            return None
        return {
            "case_id": case_id,
            "name": name,
            "status": "ACTIVE",
            "priority": priority,
            "description": description,
            "updated_at": updated_at,
            "lead_analyst": "AN-84920",
            "jurisdiction_tag": jurisdiction_tag,
        }


def client():
    repository = StubRepository()
    app.dependency_overrides[get_repository] = lambda: repository
def client(repository=None):
    app.dependency_overrides[get_repository] = lambda: repository or StubRepository()
    app.dependency_overrides[get_current_user] = lambda: {"username": "test", "role": "admin"}
    api = TestClient(app)
    api.repository = repository
    return api


def test_case_and_node_endpoints():
    with client() as api:
        assert api.get("/cases?filter=active&sort=name").status_code == 200
        assert api.get("/cases/CASE-A/overview").json()["structural_alert_count"] == 0
        assert api.get("/cases/CASE-A/nodes/top?metric=eigenvector").json()["metric"] == "eigenvector"
        assert api.get("/cases/CASE-A/nodes/N1").json()["ego_network"]["edges"][0]["type"] == "CALLED"


def test_graph_community_and_path_endpoints():
    with client() as api:
        assert api.get("/cases/CASE-A/graph?filter=bridging_only&cutoff=.75").json()["metrics"]["diameter"] == 1
        assert api.get("/cases/CASE-A/communities").json()[0]["label"] == "Cluster 1"
        assert "1.00" in api.get("/cases/CASE-A/communities/1").json()["narrative"]
        path = api.get("/cases/CASE-A/path?from_node_id=N1&to_node_id=N2").json()
    assert path["connection_strength"] == .5 and "confidence" not in path


def test_criticality_suggestions_and_validation():
    with client() as api:
        assert api.get("/cases/CASE-A/criticality?top_k=3").status_code == 200
        assert api.get("/cases/CASE-A/nodes/N1/suggested_links").json()[0]["similarity_score"] == .61
        assert api.get("/cases?filter=unknown").status_code == 422
        assert api.get("/cases/CASE-A/nodes/top?metric=pagerank").status_code == 422
        assert api.get("/cases/CASE-A/criticality?top_k=5").status_code == 422


def test_update_case_metadata():
    with client() as api:
        response = api.patch(
            "/cases/CASE-A",
            json={
                "name": "Operation Blackthorn II",
                "priority": "I",
                "description": "Updated summary",
                "jurisdiction_tag": "FINANCIAL CRIMES",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["case_id"] == "CASE-A"
        assert body["name"] == "Operation Blackthorn II"
        assert body["priority"] == "I"
        assert body["jurisdiction_tag"] == "FINANCIAL CRIMES"
        assert body["status"] == "ACTIVE"
        assert api.patch("/cases/CASE-A", json={"name": ""}).status_code == 422
        assert api.patch("/cases/MISSING", json={"name": "Nope"}).status_code == 404


def test_admin_can_create_case():
    with client() as api:
        before = {row["case_id"] for row in api.get("/cases").json()}
        response = api.post(
            "/cases",
            json={
                "case_name": "Operation Silverline",
                "priority": "II",
                "jurisdiction": "CYBER-INTEL",
                "summary": "Empty docket",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["case_id"] not in before
        assert body["case_id"].startswith("NX-")
        assert body["name"] == "Operation Silverline"
        assert body["status"] == "ACTIVE"
        assert body["priority"] == "II"
        assert body["jurisdiction_tag"] == "CYBER-INTEL"
        assert body["description"] == "Empty docket"
        assert body["node_count"] == 0
        assert body["edge_count"] == 0
        assert body["lead_analyst"] == "test"
        listed = api.get("/cases").json()
        assert any(row["case_id"] == body["case_id"] for row in listed)
        assert "CASE-A" in {row["case_id"] for row in listed}


def test_create_case_rejects_blank_name():
    with client() as api:
        assert api.post("/cases", json={"case_name": "   "}).status_code == 422
        assert api.post("/cases", json={}).status_code == 422
def test_case_status_filters_and_lifecycle():
    repository = StubRepository()
    with client(repository) as api:
        assert api.get("/cases?filter=important").status_code == 200
        assert api.get("/cases?filter=completed").status_code == 200
        assert api.get("/cases?filter=flagged").status_code == 422
        assert api.post("/cases/CASE-A/important").json()["status"] == "IMPORTANT"
        assert api.post("/cases/CASE-A/complete").json()["status"] == "COMPLETED"
        assert api.delete("/cases/CASE-A").status_code == 204


def test_summary_endpoints_return_stored_values_without_llm_call(monkeypatch):
    llm_calls = []

    def fail_if_called(*args, **kwargs):
        llm_calls.append((args, kwargs))
        raise AssertionError("request path called LLM")

    monkeypatch.setattr(httpx, "post", fail_if_called)
    with client() as api:
        case_result = api.get("/cases/CASE-A/summary")
        community_result = api.get("/cases/CASE-A/communities/1/summary")
        all_result = api.get("/cases/CASE-A/communities/summaries")

    assert case_result.status_code == 200
    assert case_result.json() == {
        "case_id": "CASE-A", "summary_text": "Stored case summary.", "source": "template",
        "generated_at": "2026-09-10T00:00:00+00:00",
    }
    assert community_result.status_code == 200
    assert community_result.json()["source"] == "llm"
    assert all_result.status_code == 200
    assert all_result.json() == [community_result.json()]
    assert llm_calls == []
