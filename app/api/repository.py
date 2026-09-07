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

    # Remaining methods are added endpoint-by-endpoint below.
