from __future__ import annotations

from typing import Any

from .. import schema_config as schema


def _as_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return row.data() if hasattr(row, "data") else dict(row)


def _serialized(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


class Neo4jRepository:
    """Parameterized, read-oriented access to persisted analysis results."""

    def __init__(self, driver: Any) -> None:
        self.driver = driver

    def list_cases(self, case_filter: str | None, sort: str) -> list[dict[str, Any]]:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        case_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
        priority = schema.cypher_identifier(schema.PROP_CASE_PRIORITY)
        description = schema.cypher_identifier(schema.PROP_CASE_DESCRIPTION)
        updated = schema.cypher_identifier(schema.PROP_CASE_UPDATED_AT)
        analyst = schema.cypher_identifier(schema.PROP_CASE_LEAD_ANALYST)
        jurisdiction = schema.cypher_identifier(schema.PROP_CASE_JURISDICTION_TAG)
        case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        circular = schema.cypher_identifier(schema.NODE_LABEL_CIRCULAR_FLOW_FLAG)
        structuring = schema.cypher_identifier(schema.NODE_LABEL_STRUCTURING_FLAG)
        labels = schema.entity_label_predicate("entity")
        query = f"""
        MATCH (case:{case_label})
        WHERE $case_filter IS NULL
           OR ($case_filter IN ['active', 'archived'] AND toLower(case.{status}) = $case_filter)
           OR ($case_filter = 'flagged' AND EXISTS {{
                MATCH (flag) WHERE (flag:{circular} OR flag:{structuring})
                  AND flag.{case_prop} = case.{case_id}
           }})
        CALL (case) {{
          OPTIONAL MATCH (entity) WHERE {labels} AND
            (entity.{case_prop} = case.{case_id} OR (entity)-[:{case_link}]->(case))
          RETURN count(DISTINCT entity) AS node_count
        }}
        CALL (case) {{
          OPTIONAL MATCH (source)-[relationship:{structural}]->(target)
          WHERE source.{case_prop} = case.{case_id} AND target.{case_prop} = case.{case_id}
          RETURN count(DISTINCT relationship) AS edge_count
        }}
        RETURN case.{case_id} AS case_id, case.{node_name} AS name,
               case.{status} AS status, case.{priority} AS priority,
               case.{description} AS description, node_count, edge_count,
               case.{updated} AS updated_at, case.{analyst} AS lead_analyst,
               case.{jurisdiction} AS jurisdiction_tag
        ORDER BY CASE WHEN $sort = 'name' THEN toLower(coalesce(case.{node_name}, case.{case_id})) END,
                 CASE WHEN $sort = 'last_activity' THEN case.{updated} END DESC,
                 case.{case_id}
        """
        with self.driver.session() as session:
            rows = [_as_dict(row) for row in session.run(
                query, case_filter=case_filter, sort=sort
            )]
        for row in rows:
            row["updated_at"] = _serialized(row.get("updated_at"))
        return rows

    def get_case_overview(self, requested_case_id: str) -> dict[str, Any] | None:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        modularity = schema.cypher_identifier(schema.PROP_CASE_MODULARITY)
        community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
        case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        circular = schema.cypher_identifier(schema.NODE_LABEL_CIRCULAR_FLOW_FLAG)
        structuring = schema.cypher_identifier(schema.NODE_LABEL_STRUCTURING_FLAG)
        labels = schema.entity_label_predicate("entity")
        source_labels = schema.entity_label_predicate("source")
        target_labels = schema.entity_label_predicate("target")
        query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})
        CALL (case) {{
          OPTIONAL MATCH (entity) WHERE {labels} AND
            (entity.{case_prop} = case.{node_id} OR (entity)-[:{case_link}]->(case))
          RETURN count(DISTINCT entity) AS total_entities,
                 count(DISTINCT entity.{community}) AS community_count
        }}
        CALL (case) {{
          OPTIONAL MATCH (source)-[relationship:{structural}]->(target)
          WHERE {source_labels} AND {target_labels}
            AND source.{case_prop} = case.{node_id} AND target.{case_prop} = case.{node_id}
          RETURN count(DISTINCT relationship) AS total_relationships,
                 size(collect(DISTINCT source) + collect(DISTINCT target)) AS direct_1hop_count
        }}
        CALL (case) {{
          OPTIONAL MATCH (flag) WHERE (flag:{circular} OR flag:{structuring})
            AND flag.{case_prop} = case.{node_id}
          RETURN count(flag) AS structural_alert_count
        }}
        RETURN case.{node_id} AS case_id, total_entities, total_relationships,
               community_count, case.{modularity} AS modularity,
               structural_alert_count, direct_1hop_count
        """
        with self.driver.session() as session:
            return _as_dict(session.run(query, case_id=requested_case_id).single())

    def get_top_nodes(
        self, requested_case_id: str, metric_property: str, limit: int
    ) -> list[dict[str, Any]]:
        allowed = {schema.PROP_BETWEENNESS, schema.PROP_EIGENVECTOR, schema.PROP_DEGREE}
        if metric_property not in allowed:
            raise ValueError("unsupported centrality property")
        labels = schema.entity_label_predicate("node")
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
        metric = schema.cypher_identifier(metric_property)
        query = f"""
        MATCH (node) WHERE {labels} AND node.{case_prop} = $case_id
        WITH node ORDER BY node.{metric} DESC, node.{node_id}
        LIMIT $limit
        RETURN node.{node_id} AS node_id, node.{node_name} AS name,
               node.{entity_type} AS entity_type, node.{metric} AS score
        """
        with self.driver.session() as session:
            rows = [_as_dict(row) for row in session.run(
                query, case_id=requested_case_id, limit=limit
            )]
        return [{**row, "rank": rank} for rank, row in enumerate(rows, 1)]


    def get_node_detail(self, requested_case_id: str, requested_node_id: str) -> dict[str, Any] | None:
        labels = schema.entity_label_predicate("node")
        neighbor_labels = schema.entity_label_predicate("neighbor")
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
        first_contact = schema.cypher_identifier(schema.PROP_FIRST_CONTACT_DATE)
        betweenness = schema.cypher_identifier(schema.PROP_BETWEENNESS)
        eigenvector = schema.cypher_identifier(schema.PROP_EIGENVECTOR)
        degree = schema.cypher_identifier(schema.PROP_DEGREE)
        community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
        role = schema.cypher_identifier(schema.PROP_STRUCTURAL_ROLE)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        weight = schema.cypher_identifier(schema.REL_WEIGHT_PROPERTY) if schema.REL_WEIGHT_PROPERTY else None
        circular = schema.cypher_identifier(schema.NODE_LABEL_CIRCULAR_FLOW_FLAG)
        structuring = schema.cypher_identifier(schema.NODE_LABEL_STRUCTURING_FLAG)
        flag_nodes = schema.cypher_identifier(schema.PROP_FLAG_NODE_IDS)
        flag_from = schema.cypher_identifier(schema.PROP_FLAG_FROM_NODE)
        flag_to = schema.cypher_identifier(schema.PROP_FLAG_TO_NODE)
        base_query = f"""
        MATCH (node) WHERE {labels} AND node.{node_id} = $node_id
          AND node.{case_prop} = $case_id
        RETURN node.{node_id} AS node_id, node.{node_name} AS name,
               node.{entity_type} AS entity_type, node.{first_contact} AS first_contact_date,
               node.{betweenness} AS betweenness, node.{eigenvector} AS eigenvector,
               node.{degree} AS degree, toString(node.{community}) AS community_id,
               node.{role} AS structural_role
        """
        edge_query = f"""
        MATCH (node)-[relationship:{structural}]-(neighbor)
        WHERE {labels} AND {neighbor_labels} AND node.{node_id} = $node_id
          AND node.{case_prop} = $case_id AND neighbor.{case_prop} = $case_id
        RETURN node.{node_id} AS node_id, neighbor.{node_id} AS neighbor_id,
+              type(relationship) AS relationship_type{f', relationship.{weight} AS weight' if weight else ', null AS weight'}
        """.replace('\n+', '\n')
        alert_query = f"""
        MATCH (flag) WHERE flag.{case_prop} = $case_id AND
+          ((flag:{circular} AND $node_id IN flag.{flag_nodes}) OR
+           (flag:{structuring} AND $node_id IN [flag.{flag_from}, flag.{flag_to}]))
        RETURN count(flag) AS alert_count
        """.replace('\n+', '\n')
        parameters = {"case_id": requested_case_id, "node_id": requested_node_id}
        with self.driver.session() as session:
            node = _as_dict(session.run(base_query, **parameters).single())
            if node is None:
                return None
            edges = [_as_dict(row) for row in session.run(edge_query, **parameters)]
            alerts = _as_dict(session.run(alert_query, **parameters).single()) or {}
        node["first_contact_date"] = _serialized(node.get("first_contact_date"))
        return {
            "node_id": node["node_id"], "name": node.get("name"),
            "entity_type": node.get("entity_type"),
            "first_contact_date": node.get("first_contact_date"),
            "scores": {key: node.get(key) for key in ("betweenness", "eigenvector", "degree")},
            "community_id": node.get("community_id"), "structural_role": node.get("structural_role"),
            "connection_count": len(edges), "structural_alert_count": int(alerts.get("alert_count", 0)),
            "ego_network": {
                "nodes": [node["node_id"], *sorted({edge["neighbor_id"] for edge in edges})],
                "edges": [{"source": node["node_id"], "target": edge["neighbor_id"],
                           "type": edge["relationship_type"], "weight": edge.get("weight")}
                          for edge in edges],
            },
        }
