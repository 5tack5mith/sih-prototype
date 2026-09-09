"""Build bounded Zone 2 inputs exclusively from persisted Zone 1 facts."""
from __future__ import annotations

from collections import Counter
from contextlib import nullcontext
from typing import Any

from . import schema_config as schema
from .database import managed_driver


def _case_scope(variable: str) -> str:
    if not variable.isidentifier():
        raise ValueError("unsafe Cypher variable")
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
    case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    return (
        f"({variable}.{case_prop} = $case_id OR EXISTS {{ MATCH ({variable})-[:{case_link}]->"
        f"(:{case_label} {{{node_id}: $case_id}}) }})"
    )


def _plain(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return row.data() if hasattr(row, "data") else dict(row)


def _json_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def _drop_empty_values(values: dict[str, Any]) -> dict[str, Any]:
    return {
        key: _json_value(value)
        for key, value in values.items()
        if value is not None and value != []
    }


def build_case_summary_context(case_id: str, *, driver: Any | None = None) -> dict[str, Any]:
    """Return a fixed, JSON-safe payload of facts already persisted by Zone 1."""
    labels = schema.entity_label_predicate("node")
    source_labels = schema.entity_label_predicate("source")
    target_labels = schema.entity_label_predicate("target")
    case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
    case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
    criticality_label = schema.cypher_identifier(schema.NODE_LABEL_CRITICALITY_RESULT)
    criticality_link = schema.cypher_identifier(schema.REL_HAS_CRITICALITY_RESULT)
    circular_label = schema.cypher_identifier(schema.NODE_LABEL_CIRCULAR_FLOW_FLAG)
    structuring_label = schema.cypher_identifier(schema.NODE_LABEL_STRUCTURING_FLAG)
    structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    betweenness = schema.cypher_identifier(schema.PROP_BETWEENNESS)
    degree = schema.cypher_identifier(schema.PROP_DEGREE)
    community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
    role = schema.cypher_identifier(schema.PROP_STRUCTURAL_ROLE)
    rank = schema.cypher_identifier(schema.PROP_RESULT_RANK)
    components = schema.cypher_identifier(schema.PROP_NUM_COMPONENTS_AFTER)
    flag_id = schema.cypher_identifier(schema.PROP_FLAG_ID)
    flag_nodes = schema.cypher_identifier(schema.PROP_FLAG_NODE_IDS)
    flag_total = schema.cypher_identifier(schema.PROP_FLAG_TOTAL_AMOUNT)
    flag_cycle = schema.cypher_identifier(schema.PROP_FLAG_CYCLE_LENGTH)
    flag_from = schema.cypher_identifier(schema.PROP_FLAG_FROM_NODE)
    flag_to = schema.cypher_identifier(schema.PROP_FLAG_TO_NODE)
    flag_count = schema.cypher_identifier(schema.PROP_FLAG_TRANSACTION_COUNT)
    flag_start = schema.cypher_identifier(schema.PROP_FLAG_WINDOW_START)
    flag_end = schema.cypher_identifier(schema.PROP_FLAG_WINDOW_END)

    counts_query = f"""
    MATCH (case:{case_label} {{{node_id}: $case_id}})
    CALL (case) {{
      OPTIONAL MATCH (node) WHERE {labels} AND {_case_scope("node")}
      RETURN count(DISTINCT node) AS node_count,
             count(DISTINCT node.{community}) AS community_count
    }}
    CALL (case) {{
      OPTIONAL MATCH (source)-[relationship:{structural}]->(target)
      WHERE {source_labels} AND {target_labels}
        AND {_case_scope("source")} AND {_case_scope("target")}
      RETURN count(DISTINCT relationship) AS edge_count
    }}
    RETURN case.{node_id} AS case_id, node_count, edge_count, community_count
    """
    players_query = f"""
    MATCH (node) WHERE {labels} AND {_case_scope("node")}
    RETURN node.{node_id} AS node_id, node.{node_name} AS name,
           node.{role} AS role, node.{betweenness} AS betweenness_score,
           node.{degree} AS degree_centrality
    ORDER BY node.{betweenness} DESC, node.{node_id}
    LIMIT 5
    """
    communities_query = f"""
    MATCH (node) WHERE {labels} AND {_case_scope("node")}
      AND node.{community} IS NOT NULL
    WITH node.{community} AS raw_community_id, node
    ORDER BY raw_community_id, node.{betweenness} DESC, node.{node_id}
    WITH raw_community_id, collect(node) AS members
    RETURN toString(raw_community_id) AS community_id, size(members) AS size,
           [member IN members | member.{role}] AS roles,
           head(members).{node_id} AS central_node_id,
           head(members).{node_name} AS central_node_name
    ORDER BY size DESC, community_id
    """
    fragmentation_query = f"""
    MATCH (case:{case_label} {{{node_id}: $case_id}})-[:{criticality_link}]->
          (result:{criticality_label})
    WITH result ORDER BY result.{rank} DESC
    WITH collect(result) AS results
    RETURN size(results) AS removed_node_count,
           head(results).{components} AS resulting_component_count
    """
    findings_query = f"""
    MATCH (flag) WHERE (flag:{circular_label} OR flag:{structuring_label})
      AND flag.{case_prop} = $case_id
    RETURN CASE WHEN flag:{circular_label} THEN 'circular_flow' ELSE 'structuring' END AS finding_type,
           flag.{flag_id} AS flag_id, flag.{flag_nodes} AS node_ids,
           flag.{flag_total} AS total_amount, flag.{flag_cycle} AS cycle_length,
           flag.{flag_from} AS from_node, flag.{flag_to} AS to_node,
           flag.{flag_count} AS transaction_count, flag.{flag_start} AS window_start,
           flag.{flag_end} AS window_end
    ORDER BY finding_type, flag_id
    """

    driver_context = nullcontext(driver) if driver is not None else managed_driver()
    with driver_context as active_driver, active_driver.session() as session:
        counts = _plain(session.run(counts_query, case_id=case_id).single())
        players = [_plain(row) for row in session.run(players_query, case_id=case_id)]
        communities = [_plain(row) for row in session.run(communities_query, case_id=case_id)]
        fragmentation = _plain(session.run(fragmentation_query, case_id=case_id).single())
        findings = [_plain(row) for row in session.run(findings_query, case_id=case_id)]

    if counts is None:
        raise ValueError(f"case not found: {case_id}")

    top_key_players = []
    for player in players:
        if player is None:
            continue
        item = {
            "name": player.get("name"),
            "id": player.get("node_id"),
            "role": (player.get("role") or "member").lower(),
            "betweenness_score": player.get("betweenness_score"),
            "degree_centrality": player.get("degree_centrality"),
        }
        top_key_players.append(_drop_empty_values(item))

    community_facts = []
    for item in communities:
        if item is None:
            continue
        role_counts = Counter((value or "member").lower() for value in item.get("roles", []))
        central = _drop_empty_values({
            "id": item.get("central_node_id"),
            "name": item.get("central_node_name"),
        })
        community_facts.append({
            "community_id": item["community_id"],
            "size": int(item["size"]),
            "role_composition": dict(sorted(role_counts.items())),
            "most_central_node": central,
        })

    context: dict[str, Any] = {
        "case_id": counts["case_id"],
        "node_count": int(counts["node_count"]),
        "edge_count": int(counts["edge_count"]),
        "community_count": int(counts["community_count"]),
        "top_key_players": top_key_players,
        "communities": community_facts,
    }
    if fragmentation:
        context["fragmentation_summary"] = _drop_empty_values(fragmentation)
    structural_findings = [
        _drop_empty_values({"type": item.pop("finding_type"), **item})
        for row in findings
        if row is not None
        for item in [dict(row)]
    ]
    if structural_findings:
        context["notable_structural_findings"] = structural_findings
    return context


def build_community_summary_context(
    case_context: dict[str, Any], community_id: str
) -> dict[str, Any]:
    """Select one aggregate community fact without exposing member-level graph data."""
    community = next(
        (item for item in case_context.get("communities", []) if item["community_id"] == community_id),
        None,
    )
    if community is None:
        raise ValueError(f"community not found: {community_id}")
    return {"case_id": case_context["case_id"], **community}
