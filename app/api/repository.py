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
              type(relationship) AS relationship_type{f', relationship.{weight} AS weight' if weight else ', null AS weight'}
        """.replace('\n+', '\n')
        alert_query = f"""
        MATCH (flag) WHERE flag.{case_prop} = $case_id AND
          ((flag:{circular} AND $node_id IN flag.{flag_nodes}) OR
           (flag:{structuring} AND $node_id IN [flag.{flag_from}, flag.{flag_to}]))
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


    def get_case_graph(self, requested_case_id: str, bridging_only: bool, cutoff: float | None) -> dict[str, Any]:
        labels = schema.entity_label_predicate("node")
        source_labels = schema.entity_label_predicate("source")
        target_labels = schema.entity_label_predicate("target")
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
        betweenness = schema.cypher_identifier(schema.PROP_BETWEENNESS)
        eigenvector = schema.cypher_identifier(schema.PROP_EIGENVECTOR)
        degree = schema.cypher_identifier(schema.PROP_DEGREE)
        community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
        role = schema.cypher_identifier(schema.PROP_STRUCTURAL_ROLE)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        weight = schema.cypher_identifier(schema.REL_WEIGHT_PROPERTY) if schema.REL_WEIGHT_PROPERTY else None
        node_query = f"""
        MATCH (node) WHERE {labels} AND node.{case_prop} = $case_id
          AND ($cutoff IS NULL OR coalesce(node.{betweenness}, 0.0) >= $cutoff)
        RETURN node.{node_id} AS node_id, node.{node_name} AS name,
              node.{entity_type} AS entity_type, node.{betweenness} AS betweenness,
              node.{degree} AS degree, node.{eigenvector} AS eigenvector,
              toString(node.{community}) AS community_id, node.{role} AS structural_role
        ORDER BY node_id
        """.replace('\n+', '\n')
        edge_query = f"""
        MATCH (source)-[relationship:{structural}]->(target)
        WHERE {source_labels} AND {target_labels}
          AND source.{case_prop} = $case_id AND target.{case_prop} = $case_id
          AND ($cutoff IS NULL OR (coalesce(source.{betweenness}, 0.0) >= $cutoff
               AND coalesce(target.{betweenness}, 0.0) >= $cutoff))
        WITH source, target, relationship, source.{community} AS source_community,
             target.{community} AS target_community
        WHERE NOT $bridging_only OR (source_community IS NOT NULL
              AND target_community IS NOT NULL AND source_community <> target_community)
        RETURN source.{node_id} AS source, target.{node_id} AS target,
              type(relationship) AS type{f', relationship.{weight} AS weight' if weight else ', null AS weight'}
        """.replace('\n+', '\n')
        density = schema.cypher_identifier(schema.PROP_CASE_DENSITY)
        diameter = schema.cypher_identifier(schema.PROP_CASE_DIAMETER)
        reciprocity = schema.cypher_identifier(schema.PROP_CASE_RECIPROCITY)
        metric_query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})
        RETURN case.{density} AS density, case.{diameter} AS diameter,
              case.{reciprocity} AS reciprocity
        """.replace('\n+', '\n')
        parameters = {"case_id": requested_case_id, "cutoff": cutoff, "bridging_only": bridging_only}
        with self.driver.session() as session:
            nodes = [_as_dict(row) for row in session.run(node_query, **parameters)]
            edges = [_as_dict(row) for row in session.run(edge_query, **parameters)]
            metrics = _as_dict(session.run(metric_query, case_id=requested_case_id).single()) or {}
        return {"nodes": nodes, "edges": edges, "metrics": metrics}


    def get_communities(self, requested_case_id: str) -> list[dict[str, Any]]:
        labels = schema.entity_label_predicate("node")
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
        size_prop = schema.cypher_identifier(schema.PROP_COMMUNITY_SIZE)
        internal = schema.cypher_identifier(schema.PROP_COMMUNITY_INTERNAL_DENSITY)
        external = schema.cypher_identifier(schema.PROP_COMMUNITY_EXTERNAL_DENSITY)
        query = f"""
        MATCH (node) WHERE {labels} AND node.{case_prop} = $case_id
          AND node.{community} IS NOT NULL
        WITH node.{community} AS raw_id, collect(node) AS members
        RETURN toString(raw_id) AS community_id, size(members) AS size,
               coalesce(head(members).{internal}, 0.0) AS internal_density,
               coalesce(head(members).{external}, 0.0) AS external_density,
               [member IN members | member.{node_id}] AS member_node_ids
        ORDER BY size DESC, community_id
        """
        with self.driver.session() as session:
            rows = [_as_dict(row) for row in session.run(query, case_id=requested_case_id)]
        return [{**row, "label": f"Cluster {row['community_id']}"} for row in rows]

    def get_community_detail(self, requested_case_id: str, requested_community_id: str) -> dict[str, Any] | None:
        labels = schema.entity_label_predicate("node")
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
        community = schema.cypher_identifier(schema.PROP_COMMUNITY_ID)
        internal = schema.cypher_identifier(schema.PROP_COMMUNITY_INTERNAL_DENSITY)
        external = schema.cypher_identifier(schema.PROP_COMMUNITY_EXTERNAL_DENSITY)
        centrality = schema.cypher_identifier(schema.PROP_BETWEENNESS)
        query = f"""
        MATCH (node) WHERE {labels} AND node.{case_prop} = $case_id
          AND toString(node.{community}) = $community_id
        WITH collect(node) AS members
        WHERE size(members) > 0
        RETURN $community_id AS community_id, size(members) AS size,
               coalesce(head(members).{internal}, 0.0) AS internal_density,
               coalesce(head(members).{external}, 0.0) AS external_density,
               [member IN members | {{node_id: member.{node_id}, name: member.{node_name},
                 entity_type: member.{entity_type}, centrality: member.{centrality}}}] AS members
        """
        with self.driver.session() as session:
            return _as_dict(session.run(query, case_id=requested_case_id,
                                        community_id=requested_community_id).single())


    def find_path(self, requested_case_id: str, from_node_id: str, to_node_id: str) -> dict[str, Any]:
        source_labels = schema.entity_label_predicate("source")
        target_labels = schema.entity_label_predicate("target")
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        weight = schema.cypher_identifier(schema.REL_WEIGHT_PROPERTY) if schema.REL_WEIGHT_PROPERTY else None
        weight_expression = f"coalesce(relationship.{weight}, 1.0)" if weight else "1.0"
        query = f"""
        MATCH (source), (target)
        WHERE {source_labels} AND {target_labels}
          AND source.{node_id} = $from_node_id AND target.{node_id} = $to_node_id
          AND source.{case_prop} = $case_id AND target.{case_prop} = $case_id
        MATCH path = shortestPath((source)-[:{structural}*..{schema.PATH_MAX_HOPS}]-(target))
        WHERE all(node IN nodes(path) WHERE node.{case_prop} = $case_id)
          AND all(relationship IN relationships(path) WHERE
              coalesce(relationship.{case_prop}, $case_id) = $case_id)
        RETURN [node IN nodes(path) | node.{node_id}] AS node_ids,
               [node IN nodes(path) | node.{node_name}] AS node_names,
               [relationship IN relationships(path) | type(relationship)] AS relationship_types,
               [relationship IN relationships(path) | {weight_expression}] AS weights
        """
        with self.driver.session() as session:
            row = _as_dict(session.run(query, case_id=requested_case_id,
                from_node_id=from_node_id, to_node_id=to_node_id).single())
        if row is None:
            return {"path_found": False, "hops": None, "connection_strength": None,
                    "total_relationship_count": 0, "nodes": [], "steps": []}
        weights = [float(value) for value in row["weights"]]
        steps = [{
            "step": index + 1, "from": row["node_names"][index],
            "to": row["node_names"][index + 1],
            "relationship_type": row["relationship_types"][index],
            "detail": f"{row['relationship_types'][index]} (weight {weights[index]:g})",
        } for index in range(len(weights))]
        strength = sum(value / (value + 1.0) for value in weights) / len(weights) if weights else 0.0
        return {"path_found": True, "hops": len(weights),
                "connection_strength": round(strength, 4),
                "total_relationship_count": int(round(sum(weights))),
                "nodes": row["node_ids"], "steps": steps}
