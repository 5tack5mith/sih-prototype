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


def test_summary_reads_are_parameterized_and_use_schema_constants(fake_driver):
    repository = Neo4jRepository(fake_driver)

    repository.get_case_summary("CASE-'unsafe")
    repository.get_community_summary("CASE-'unsafe", "COMM-'unsafe")
    repository.get_community_summaries("CASE-'unsafe")

    query_text = "\n".join(query for query, _ in fake_driver.calls)
    assert "CASE-'unsafe" not in query_text
    assert "COMM-'unsafe" not in query_text
    assert schema.cypher_identifier(schema.PROP_CASE_SUMMARY_TEXT) in query_text
    assert schema.cypher_identifier(schema.PROP_CASE_SUMMARY_SOURCE) in query_text
    assert schema.cypher_identifier(schema.PROP_CASE_SUMMARY_GENERATED_AT) in query_text
    assert schema.cypher_identifier(schema.NODE_LABEL_COMMUNITY_SUMMARY) in query_text
    assert fake_driver.calls[0][1] == {"case_id": "CASE-'unsafe"}
    assert fake_driver.calls[1][1] == {"case_id": "CASE-'unsafe", "community_id": "COMM-'unsafe"}
