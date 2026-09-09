from app import schema_config as schema
from app.api.repository import Neo4jRepository


def test_repository_uses_schema_contract_and_parameters(fake_driver):
    repository = Neo4jRepository(fake_driver)
    repository.get_top_nodes("CASE-A", schema.PROP_BETWEENNESS, 10)
    query, parameters = fake_driver.calls[-1]
    assert schema.cypher_identifier(schema.PROP_BETWEENNESS) in query
    assert parameters == {"case_id": "CASE-A", "limit": 10}
    assert "CASE-A" not in query


def test_graph_filter_is_applied_in_cypher(fake_driver):
    repository = Neo4jRepository(fake_driver)
    repository.get_case_graph("CASE-A", bridging_only=True, cutoff=.75)
    query_text = "\n".join(query for query, _ in fake_driver.calls)
    assert "source_community <> target_community" in query_text
    assert any(parameters.get("cutoff") == .75 for _, parameters in fake_driver.calls)


def test_path_query_is_case_scoped_and_parameterized(fake_driver):
    repository = Neo4jRepository(fake_driver)
    result = repository.find_path("CASE-A", "N1", "N2")
    query, parameters = fake_driver.calls[-1]
    assert schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES) in query
    assert parameters == {"case_id": "CASE-A", "from_node_id": "N1", "to_node_id": "N2"}
    assert result["path_found"] is False


def test_create_case_is_parameterized_and_does_not_touch_other_cases(fake_driver):
    def handler(query, parameters):
        if "STARTS WITH" in query:
            return [{"case_id": "CASE-A"}]
        return [{
            "case_id": parameters["case_id"],
            "name": parameters["name"],
            "status": parameters["status"],
            "priority": parameters["priority"],
            "description": parameters["description"],
            "updated_at": parameters["updated_at"],
            "lead_analyst": parameters["lead_analyst"],
            "jurisdiction_tag": parameters["jurisdiction_tag"],
        }]

    fake_driver.handler = handler
    repository = Neo4jRepository(fake_driver)
    created = repository.create_case(
        "Operation Silverline",
        "II",
        "Empty docket",
        "CYBER-INTEL",
        "admin",
        "2026-09-10T00:00:00+00:00",
    )
    assert created["status"] == "ACTIVE"
    assert created["node_count"] == 0
    assert created["edge_count"] == 0
    assert created["name"] == "Operation Silverline"
    query_text = "\n".join(query for query, _ in fake_driver.calls)
    assert "DETACH DELETE" not in query_text
    assert "CASE-A" not in query_text
    assert any(parameters.get("name") == "Operation Silverline" for _, parameters in fake_driver.calls)
