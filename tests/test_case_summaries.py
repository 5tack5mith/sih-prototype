from app import schema_config as schema
from app.case_summaries import build_case_summary_context


def test_build_case_summary_context_uses_only_persisted_facts(fake_driver):
    responses = [
        [{"case_id": "CASE-A", "node_count": 8, "edge_count": 10, "community_count": 2}],
        [
            {"node_id": "P1", "name": "Person One", "role": "BROKER", "betweenness_score": 0.8, "degree_centrality": 4.0},
            {"node_id": "P2", "name": None, "role": "MEMBER", "betweenness_score": 0.4, "degree_centrality": 2.0},
        ],
        [
            {"community_id": "7", "size": 3, "roles": ["BROKER", "MEMBER", "MEMBER"], "central_node_id": "P1", "central_node_name": "Person One"},
        ],
        [{"removed_node_count": 2, "resulting_component_count": 3}],
        [
            {"finding_type": "circular_flow", "flag_id": "F1", "node_ids": ["P1", "P2"], "total_amount": 1000.0, "cycle_length": 2, "from_node": None, "to_node": None, "transaction_count": None, "window_start": None, "window_end": None},
        ],
    ]
    fake_driver.handler = lambda _query, _parameters: responses.pop(0)

    context = build_case_summary_context("CASE-A", driver=fake_driver)

    assert context == {
        "case_id": "CASE-A",
        "node_count": 8,
        "edge_count": 10,
        "community_count": 2,
        "top_key_players": [
            {"name": "Person One", "id": "P1", "role": "broker", "betweenness_score": 0.8, "degree_centrality": 4.0},
            {"id": "P2", "role": "member", "betweenness_score": 0.4, "degree_centrality": 2.0},
        ],
        "communities": [{
            "community_id": "7",
            "size": 3,
            "role_composition": {"broker": 1, "member": 2},
            "most_central_node": {"id": "P1", "name": "Person One"},
        }],
        "fragmentation_summary": {"removed_node_count": 2, "resulting_component_count": 3},
        "notable_structural_findings": [{
            "type": "circular_flow", "flag_id": "F1", "node_ids": ["P1", "P2"],
            "total_amount": 1000.0, "cycle_length": 2,
        }],
    }


def test_summary_context_queries_are_parameterized_and_use_schema_constants(fake_driver):
    fake_driver.handler = lambda _query, _parameters: []

    try:
        build_case_summary_context("CASE-'unsafe", driver=fake_driver)
    except ValueError:
        pass

    query_text = "\n".join(query for query, _ in fake_driver.calls)
    assert "CASE-'unsafe" not in query_text
    assert all(parameters.get("case_id") == "CASE-'unsafe" for _, parameters in fake_driver.calls)
    assert schema.cypher_identifier(schema.PROP_BETWEENNESS) in query_text
    assert schema.cypher_identifier(schema.PROP_STRUCTURAL_ROLE) in query_text
    assert schema.cypher_identifier(schema.PROP_NUM_COMPONENTS_AFTER) in query_text
    assert schema.cypher_identifier(schema.PROP_FLAG_ID) in query_text
