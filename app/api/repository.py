from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .. import schema_config as schema
from .case_ids import allocate_case_id


def _as_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return row.data() if hasattr(row, "data") else dict(row)


def _serialized(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _case_scope(variable: str, parameter: str = "$case_id") -> str:
    """Match either entity.case_id or the configured entity-to-Case relationship."""
    if not variable.isidentifier():
        raise ValueError("unsafe Cypher variable")
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
    case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    return (f"({variable}.{case_prop} = {parameter} OR EXISTS {{ "
            f"MATCH ({variable})-[:{case_link}]->(:{case_label} {{{node_id}: {parameter}}}) }})")


class Neo4jRepository:
    """Parameterized, read-oriented access to persisted analysis results."""

    def __init__(self, driver: Any) -> None:
        self.driver = driver

    def list_cases(self, case_filter: str | None, sort: str, allowed_case_ids: list[str] | None = None) -> list[dict[str, Any]]:
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
        WHERE ($allowed_case_ids IS NULL OR case.{case_id} IN $allowed_case_ids)
          AND ($case_filter IS NULL
           OR ($case_filter IN ['active', 'archived'] AND toLower(case.{status}) = $case_filter)
           OR ($case_filter = 'flagged' AND EXISTS {{
                MATCH (flag) WHERE (flag:{circular} OR flag:{structuring})
                  AND flag.{case_prop} = case.{case_id}
           }}))
        CALL (case) {{
          OPTIONAL MATCH (entity) WHERE {labels} AND
            (entity.{case_prop} = case.{case_id} OR (entity)-[:{case_link}]->(case))
          RETURN count(DISTINCT entity) AS node_count
        }}
        CALL (case) {{
          OPTIONAL MATCH (source)-[relationship:{structural}]->(target)
          WHERE {_case_scope("source", "case." + case_id)} AND {_case_scope("target", "case." + case_id)}
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
                query, case_filter=case_filter, sort=sort, allowed_case_ids=allowed_case_ids
            )]
        for row in rows:
            row["updated_at"] = _serialized(row.get("updated_at"))
        return rows

    def get_case(self, requested_case_id: str) -> dict[str, Any] | None:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
        query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})
        RETURN case.{node_id} AS case_id, case.{status} AS status
        """
        with self.driver.session() as session:
            return _as_dict(session.run(query, case_id=requested_case_id).single())

    def create_case(
        self,
        name: str,
        priority: str | None,
        description: str | None,
        jurisdiction_tag: str | None,
        lead_analyst: str | None,
        updated_at: str,
    ) -> dict[str, Any] | None:
        """Create one empty ACTIVE case. Graph data of other cases is not touched."""
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
        priority_prop = schema.cypher_identifier(schema.PROP_CASE_PRIORITY)
        description_prop = schema.cypher_identifier(schema.PROP_CASE_DESCRIPTION)
        updated = schema.cypher_identifier(schema.PROP_CASE_UPDATED_AT)
        analyst = schema.cypher_identifier(schema.PROP_CASE_LEAD_ANALYST)
        jurisdiction = schema.cypher_identifier(schema.PROP_CASE_JURISDICTION_TAG)
        existing_query = f"""
        MATCH (case:{case_label})
        WHERE case.{node_id} = $prefix OR case.{node_id} STARTS WITH $numbered_prefix
        RETURN case.{node_id} AS case_id
        """
        create_query = f"""
        OPTIONAL MATCH (existing:{case_label} {{{node_id}: $case_id}})
        WITH existing
        WHERE existing IS NULL
        CREATE (case:{case_label})
        SET case.{node_id} = $case_id,
            case.{node_name} = $name,
            case.{status} = $status,
            case.{priority_prop} = $priority,
            case.{description_prop} = $description,
            case.{jurisdiction} = $jurisdiction_tag,
            case.{analyst} = $lead_analyst,
            case.{updated} = $updated_at
        RETURN case.{node_id} AS case_id, case.{node_name} AS name,
               case.{status} AS status, case.{priority_prop} AS priority,
               case.{description_prop} AS description, case.{updated} AS updated_at,
               case.{analyst} AS lead_analyst, case.{jurisdiction} AS jurisdiction_tag
        """
        with self.driver.session() as session:
            now = datetime.now(timezone.utc)
            id_prefix = f"NX-{now.year}-{now.month:02d}{now.day:02d}"
            existing_rows = session.run(
                existing_query, prefix=id_prefix, numbered_prefix=f"{id_prefix}-"
            )
            existing_ids = {row["case_id"] for row in existing_rows if row.get("case_id")}
            for _ in range(8):
                case_id = allocate_case_id(existing_ids, now)
                row = _as_dict(session.run(
                    create_query,
                    case_id=case_id,
                    name=name,
                    status="ACTIVE",
                    priority=priority,
                    description=description,
                    jurisdiction_tag=jurisdiction_tag,
                    lead_analyst=lead_analyst,
                    updated_at=updated_at,
                ).single())
                if row is not None:
                    row["updated_at"] = _serialized(row.get("updated_at"))
                    row["node_count"] = 0
                    row["edge_count"] = 0
                    return row
                existing_ids.add(case_id)
        return None

    def update_case_metadata(
        self,
        requested_case_id: str,
        name: str,
        priority: str | None,
        description: str | None,
        jurisdiction_tag: str | None,
        updated_at: str,
    ) -> dict[str, Any] | None:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
        priority_prop = schema.cypher_identifier(schema.PROP_CASE_PRIORITY)
        description_prop = schema.cypher_identifier(schema.PROP_CASE_DESCRIPTION)
        updated = schema.cypher_identifier(schema.PROP_CASE_UPDATED_AT)
        analyst = schema.cypher_identifier(schema.PROP_CASE_LEAD_ANALYST)
        jurisdiction = schema.cypher_identifier(schema.PROP_CASE_JURISDICTION_TAG)
        query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})
        SET case.{node_name} = $name,
            case.{priority_prop} = $priority,
            case.{description_prop} = $description,
            case.{jurisdiction} = $jurisdiction_tag,
            case.{updated} = $updated_at
        RETURN case.{node_id} AS case_id, case.{node_name} AS name,
               case.{status} AS status, case.{priority_prop} AS priority,
               case.{description_prop} AS description, case.{updated} AS updated_at,
               case.{analyst} AS lead_analyst, case.{jurisdiction} AS jurisdiction_tag
        """
        with self.driver.session() as session:
            row = _as_dict(session.run(
                query,
                case_id=requested_case_id,
                name=name,
                priority=priority,
                description=description,
                jurisdiction_tag=jurisdiction_tag,
                updated_at=updated_at,
            ).single())
        if row is None:
            return None
        row["updated_at"] = _serialized(row.get("updated_at"))
        return row

    def set_case_status(self, requested_case_id: str, new_status: str) -> dict[str, Any] | None:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
        query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})
        SET case.{status} = $status
        RETURN case.{node_id} AS case_id, case.{status} AS status
        """
        with self.driver.session() as session:
            return _as_dict(session.run(query, case_id=requested_case_id, status=new_status).single())

    def purge_archived_case(self, requested_case_id: str) -> bool:
        """Delete one archived case and its scoped data without touching other cases."""
        case = self.get_case(requested_case_id)
        if case is None:
            return False
        if (case.get("status") or "").upper() != "ARCHIVED":
            raise ValueError("case must be archived before purging")
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        case_link = schema.cypher_identifier(schema.REL_CASE_LINK)
        projections = [schema.projection_name(requested_case_id), schema.projection_name(requested_case_id, directed=True)]
        drop_query = """
        CALL gds.graph.exists($projection_name) YIELD exists
        WITH exists WHERE exists
        CALL gds.graph.drop($projection_name, false) YIELD graphName
        RETURN graphName
        """
        delete_relationships = f"""
        MATCH ()-[relationship]->()
        WHERE relationship.{case_prop} = $case_id
        DELETE relationship
        """
        delete_nodes = f"""
        MATCH (node)
        WHERE node.{case_prop} = $case_id
           OR EXISTS {{ MATCH (node)-[:{case_link}]->(:{case_label} {{{node_id}: $case_id}}) }}
           OR (node:{case_label} AND node.{node_id} = $case_id)
        DETACH DELETE node
        """
        with self.driver.session() as session:
            for projection in projections:
                session.run(drop_query, projection_name=projection).consume()
            session.run(delete_relationships, case_id=requested_case_id).consume()
            session.run(delete_nodes, case_id=requested_case_id).consume()
        return True

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
            AND {_case_scope("source", "case." + node_id)} AND {_case_scope("target", "case." + node_id)}
          RETURN count(DISTINCT relationship) AS total_relationships,
                 size(reduce(unique = [], item IN collect(DISTINCT source) + collect(DISTINCT target) |
                   CASE WHEN item IN unique THEN unique ELSE unique + item END)) AS direct_1hop_count
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
        MATCH (node) WHERE {labels} AND {_case_scope("node")}
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
          AND {_case_scope("node")}
        RETURN node.{node_id} AS node_id, node.{node_name} AS name,
               node.{entity_type} AS entity_type, node.{first_contact} AS first_contact_date,
               node.{betweenness} AS betweenness, node.{eigenvector} AS eigenvector,
               node.{degree} AS degree, toString(node.{community}) AS community_id,
               node.{role} AS structural_role
        """
        edge_query = f"""
        MATCH (node)-[relationship:{structural}]-(neighbor)
        WHERE {labels} AND {neighbor_labels} AND node.{node_id} = $node_id
          AND {_case_scope("node")} AND {_case_scope("neighbor")}
        RETURN node.{node_id} AS node_id, neighbor.{node_id} AS neighbor_id,
              type(relationship) AS relationship_type{f', relationship.{weight} AS weight' if weight else ', null AS weight'}
        """.replace('\n+', '\n')
        alert_query = f"""
        MATCH (flag) WHERE flag.{case_prop} = $case_id AND
          ((flag:{circular} AND $node_id IN flag.{flag_nodes}) OR
           (flag:{structuring} AND $node_id IN [flag.{flag_from}, flag.{flag_to}]))
        RETURN count(flag) AS alert_count
        """.replace('\n+', '\n')
        # Identity fields (phone/account) live on the raw Phone/Account nodes,
        # not on Person itself - reached the same way project_person_graph.py
        # resolves ownership, via the Person-[:OWNS]->{Account,Phone} edges
        # ingest_dataset.py synthesizes. aliases is defensive: every person in
        # the current dataset has an empty aliases list (entities.py never
        # populates it, and ingest_dataset.py doesn't currently carry it onto
        # the node at all), so this always returns [] today - coalesce here
        # means it starts working automatically if that ever changes, with
        # zero query changes needed.
        owns = schema.cypher_identifier(schema.RAW_REL_OWNS)
        phone_label = schema.cypher_identifier(schema.RAW_NODE_LABEL_PHONE)
        account_label = schema.cypher_identifier(schema.RAW_NODE_LABEL_ACCOUNT)
        identity_query = f"""
        MATCH (node) WHERE {labels} AND node.{node_id} = $node_id AND {_case_scope("node")}
        OPTIONAL MATCH (node)-[:{owns}]->(phone:{phone_label})
        OPTIONAL MATCH (node)-[:{owns}]->(account:{account_label})
        RETURN coalesce(node.aliases, []) AS aliases,
               [p IN collect(DISTINCT phone.phone_number) WHERE p IS NOT NULL] AS phone_numbers,
               [a IN collect(DISTINCT account.{node_id}) WHERE a IS NOT NULL] AS account_ids
        """.replace('\n+', '\n')
        parameters = {"case_id": requested_case_id, "node_id": requested_node_id}
        with self.driver.session() as session:
            node = _as_dict(session.run(base_query, **parameters).single())
            if node is None:
                return None
            edges = [_as_dict(row) for row in session.run(edge_query, **parameters)]
            alerts = _as_dict(session.run(alert_query, **parameters).single()) or {}
            identity = _as_dict(session.run(identity_query, **parameters).single()) or {}
        node["first_contact_date"] = _serialized(node.get("first_contact_date"))
        return {
            "node_id": node["node_id"], "name": node.get("name"),
            "entity_type": node.get("entity_type"),
            "first_contact_date": node.get("first_contact_date"),
            "scores": {key: node.get(key) for key in ("betweenness", "eigenvector", "degree")},
            "community_id": node.get("community_id"), "structural_role": node.get("structural_role"),
            "connection_count": len(edges), "structural_alert_count": int(alerts.get("alert_count", 0)),
            "aliases": identity.get("aliases") or [],
            "phone_numbers": identity.get("phone_numbers") or [],
            "account_ids": identity.get("account_ids") or [],
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
        one_sided_types = schema.cypher_string_list(schema.ONE_SIDED_SCOPE_REL_TYPES)
        noise_prop = schema.cypher_identifier(schema.PROP_IS_BACKGROUND_NOISE)
        weight = schema.cypher_identifier(schema.REL_WEIGHT_PROPERTY) if schema.REL_WEIGHT_PROPERTY else None
        # SHARED_ADDRESS/SHARED_DEVICE use one-sided case scoping, restricted
        # to a background-noise person (no case_id) connected to that case's
        # own person - the approved noise-handling design, not general
        # one-sided leniency (which could otherwise leak a different case's
        # person into this one via a hypothetical cross-case shared-address
        # link). Every other structural edge type keeps normal two-sided
        # scoping.
        node_query = f"""
        MATCH (node) WHERE {labels}
          AND ({_case_scope("node")} OR (
            coalesce(node.{noise_prop}, false) = true AND EXISTS {{
              MATCH (node)-[noise_link]-(ring)
              WHERE type(noise_link) IN {one_sided_types} AND {_case_scope("ring")}
            }}
          ))
          AND ($cutoff IS NULL OR coalesce(node.{betweenness}, 0.0) >= $cutoff)
          AND (NOT $bridging_only OR EXISTS {{
            MATCH (node)-[:{structural}]-(bridge_neighbor)
            WHERE {_case_scope("bridge_neighbor")} AND node.{community} IS NOT NULL
              AND bridge_neighbor.{community} IS NOT NULL
              AND node.{community} <> bridge_neighbor.{community}
              AND ($cutoff IS NULL OR coalesce(bridge_neighbor.{betweenness}, 0.0) >= $cutoff)
          }})
        RETURN node.{node_id} AS node_id, node.{node_name} AS name,
              node.{entity_type} AS entity_type, node.{betweenness} AS betweenness,
              node.{degree} AS degree, node.{eigenvector} AS eigenvector,
              toString(node.{community}) AS community_id, node.{role} AS structural_role
        ORDER BY node_id
        """.replace('\n+', '\n')
        edge_query = f"""
        MATCH (source)-[relationship:{structural}]->(target)
        WHERE {source_labels} AND {target_labels}
          AND (
            (type(relationship) IN {one_sided_types} AND (
              ({_case_scope("source")} AND (coalesce(target.{noise_prop}, false) = true OR {_case_scope("target")}))
              OR ({_case_scope("target")} AND (coalesce(source.{noise_prop}, false) = true OR {_case_scope("source")}))
            ))
            OR (NOT type(relationship) IN {one_sided_types}
              AND {_case_scope("source")} AND {_case_scope("target")})
          )
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
        MATCH (node) WHERE {labels} AND {_case_scope("node")}
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
        MATCH (node) WHERE {labels} AND {_case_scope("node")}
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
          AND {_case_scope("source")} AND {_case_scope("target")}
        MATCH path = shortestPath((source)-[:{structural}*..{schema.PATH_MAX_HOPS}]-(target))
        WHERE all(node IN nodes(path) WHERE {_case_scope("node")})
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


    def get_criticality(self, requested_case_id: str, top_k: int) -> dict[str, Any]:
        case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
        result_label = schema.cypher_identifier(schema.NODE_LABEL_CRITICALITY_RESULT)
        result_link = schema.cypher_identifier(schema.REL_HAS_CRITICALITY_RESULT)
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
        role = schema.cypher_identifier(schema.PROP_STRUCTURAL_ROLE)
        rank = schema.cypher_identifier(schema.PROP_RESULT_RANK)
        result_node = schema.cypher_identifier(schema.PROP_RESULT_NODE_ID)
        before = schema.cypher_identifier(schema.PROP_LARGEST_COMPONENT_BEFORE)
        after = schema.cypher_identifier(schema.PROP_LARGEST_COMPONENT_AFTER)
        components = schema.cypher_identifier(schema.PROP_NUM_COMPONENTS_AFTER)
        baseline_nodes = schema.cypher_identifier(schema.PROP_BASELINE_NODE_COUNT)
        efficiency_before = schema.cypher_identifier(schema.PROP_GLOBAL_EFFICIENCY_BEFORE)
        efficiency_after = schema.cypher_identifier(schema.PROP_GLOBAL_EFFICIENCY_AFTER)
        labels = schema.entity_label_predicate("node")
        query = f"""
        MATCH (case:{case_label} {{{node_id}: $case_id}})-[:{result_link}]->(result:{result_label})
        OPTIONAL MATCH (node) WHERE {labels} AND node.{node_id} = result.{result_node}
        WITH result, node ORDER BY result.{rank}
        RETURN result.{rank} AS rank, result.{result_node} AS node_id,
               node.{node_name} AS node_name, node.{entity_type} AS entity_type,
               node.{role} AS structural_role, result.{before} AS component_size_before,
               result.{after} AS component_size_after, result.{components} AS num_components_after,
               result.{baseline_nodes} AS baseline_node_count,
               result.{efficiency_before} AS efficiency_before,
               result.{efficiency_after} AS efficiency_after
        """
        with self.driver.session() as session:
            all_rows = [_as_dict(row) for row in session.run(query, case_id=requested_case_id)]
        selected = all_rows[:top_k]
        removals = []
        for row in selected:
            before_size = int(row["component_size_before"])
            reduction = 100.0 * (before_size - int(row["component_size_after"])) / before_size if before_size else 0.0
            label = "CRITICAL CUT" if row["rank"] == 1 and reduction >= 25.0 else (row.get("structural_role") or row.get("entity_type") or "STRUCTURAL MEMBER")
            removals.append({"rank": row["rank"], "node_id": row["node_id"],
                "node_name": row.get("node_name"), "entity_type_label": label,
                "component_size_before": before_size,
                "component_size_after": row["component_size_after"],
                "fragmentation_pct": round(reduction, 1)})
        final = selected[-1] if selected else None
        baseline_efficiency = selected[0].get("efficiency_before") if selected else None
        final_efficiency = final.get("efficiency_after") if final else None
        efficiency_drop = (100.0 * (baseline_efficiency - final_efficiency) / baseline_efficiency
                           if baseline_efficiency not in (None, 0) and final_efficiency is not None else 0.0)
        note = (f"Only {len(all_rows)} results were precomputed; {top_k} were requested."
                if len(all_rows) < top_k else None)
        return {"case_id": requested_case_id,
                "initial_node_count": int(all_rows[0].get("baseline_node_count") or 0) if all_rows else 0,
                "criterion": "largest_component_fragmentation", "ranked_removals": removals,
                "final_state": {"components_created": int(final["num_components_after"]) if final else 0,
                    "largest_remaining_component": int(final["component_size_after"]) if final else 0,
                    "overall_efficiency_drop_pct": round(efficiency_drop, 1)}, "note": note}


    def get_suggested_links(self, requested_case_id: str, requested_node_id: str) -> list[dict[str, Any]]:
        labels = schema.entity_label_predicate("node")
        suggested_labels = schema.entity_label_predicate("suggested")
        node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
        node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
        case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
        similar = schema.cypher_identifier(schema.REL_SIMILAR_TO)
        score = schema.cypher_identifier(schema.REL_SIMILAR_TO_SCORE_PROP)
        structural = schema.relationship_type_union(schema.STRUCTURAL_REL_TYPES)
        query = f"""
        MATCH (node)-[similarity:{similar}]-(suggested)
        WHERE {labels} AND {suggested_labels} AND node.{node_id} = $node_id
          AND {_case_scope("node")} AND {_case_scope("suggested")}
          AND NOT (node)-[:{structural}]-(suggested)
        RETURN DISTINCT suggested.{node_id} AS suggested_node_id,
               suggested.{node_name} AS suggested_name,
               similarity.{score} AS similarity_score
        ORDER BY similarity_score DESC, suggested_node_id
        """
        with self.driver.session() as session:
            return [_as_dict(row) for row in session.run(
                query, case_id=requested_case_id, node_id=requested_node_id
            )]
