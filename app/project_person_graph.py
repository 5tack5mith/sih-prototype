"""Materialize the PERSON-only analytical projection from the raw graph.

Builds TRANSACTED_WITH: PERSON->PERSON, one aggregated relationship per
ordered (source_person, target_person) pair, resolved from raw
Account-level TRANSACTION edges via
    Person -[:OWNS]-> Account -[:TRANSACTION]-> Account <-[:OWNS]- Person
(app.ingest_dataset creates the OWNS edges the traversal above depends on).

Rules (approved architecture):
  - Self-transactions (source person == target person) are excluded
    unconditionally.
  - Transactions terminating at a CryptoOfframp are excluded: CryptoOfframp
    has no OWNS edge, so the traversal pattern above simply never matches
    them - no special-casing needed.
  - Multiple raw transactions between the same ordered pair are aggregated
    into one TRANSACTED_WITH edge: transaction_count, total_amount,
    first_timestamp, last_timestamp, weight (sum of computed_weight), and
    transaction_ids (back-pointers to the raw TRANSACTION.id values) so
    detailed inspection can always drill back down. (The current 150-case
    dataset happens to have zero pairs with more than one transaction -
    verified directly - but this aggregation is not conditional on that;
    it runs unconditionally so it stays correct if that ever changes.)
  - A pair is included only when BOTH people resolve to a real case
    (case_id is not null) - this excludes pure background-noise-internal
    transactions from the analytical graph entirely (they can never surface
    through any per-case query anyway) while including both same-case pairs
    and the deliberate cross-case bridge pairs.
  - Same-case pairs get that case's case_id. Cross-case pairs (the two
    people resolve to different cases - the 75 bridge transactions) get NO
    case_id property at all, exactly like the raw bridge transactions
    already have none. This is what keeps them out of every case-scoped
    query (get_case_graph, find_path, criticality, financial-pattern
    detection) without any of those query sites needing special-case logic:
    they already require both endpoints to resolve to the SAME requested
    case_id.

Idempotent: deletes and rebuilds every TRANSACTED_WITH edge on each run,
matching the existing Zone 1 jobs' rebuild-from-scratch pattern (e.g.
run_core_algorithms.py's SIMILAR_TO handling).

SHARED_ADDRESS/SHARED_DEVICE need no equivalent build step: they are
already Person->Person in the raw graph (app.ingest_dataset.load_shared_edges)
and are used directly as analytical edges.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from . import schema_config as schema
from .database import managed_driver


@dataclass(frozen=True)
class ProjectionSummary:
    same_case_edges: int
    cross_case_edges: int
    raw_transactions_used: int


def _resolved_transactions(driver: Any) -> list[dict[str, Any]]:
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    account_label = schema.cypher_identifier(schema.RAW_NODE_LABEL_ACCOUNT)
    owns = schema.cypher_identifier(schema.RAW_REL_OWNS)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    relationship_id = schema.cypher_identifier(schema.PROP_RELATIONSHIP_ID)
    amount = schema.cypher_identifier(schema.TXN_PROP_AMOUNT)
    timestamp = schema.cypher_identifier(schema.TXN_PROP_TIMESTAMP)
    query = f"""
    MATCH (p1:{person_label})-[:{owns}]->(:{account_label})-[t:TRANSACTION]->
          (:{account_label})<-[:{owns}]-(p2:{person_label})
    WHERE p1.{node_id} <> p2.{node_id}
      AND p1.{case_prop} IS NOT NULL AND p2.{case_prop} IS NOT NULL
    RETURN p1.{node_id} AS source_id, p2.{node_id} AS target_id,
           p1.{case_prop} AS source_case, p2.{case_prop} AS target_case,
           t.{relationship_id} AS txn_id, t.{amount} AS amount,
           t.{timestamp} AS timestamp, t.computed_weight AS weight
    """
    with driver.session() as session:
        return [dict(row) for row in session.run(query)]


def _aggregate(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[(row["source_id"], row["target_id"])].append(row)

    aggregated = []
    for (source_id, target_id), items in groups.items():
        timestamps = [item["timestamp"] for item in items]
        source_case = items[0]["source_case"]
        target_case = items[0]["target_case"]
        aggregated.append({
            "source_id": source_id,
            "target_id": target_id,
            "case_id": source_case if source_case == target_case else None,
            "transaction_count": len(items),
            "total_amount": sum(float(item["amount"]) for item in items),
            "first_timestamp": min(timestamps).isoformat(),
            "last_timestamp": max(timestamps).isoformat(),
            "weight": sum(float(item["weight"]) for item in items),
            "transaction_ids": [item["txn_id"] for item in items],
        })
    return aggregated


def _delete_existing(driver: Any) -> None:
    rel_type = schema.cypher_identifier(schema.REL_TRANSACTION)
    with driver.session() as session:
        session.run(f"MATCH ()-[r:{rel_type}]->() DELETE r").consume()


def _write_edges(driver: Any, aggregated: list[dict[str, Any]]) -> None:
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    rel_type = schema.cypher_identifier(schema.REL_TRANSACTION)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    txn_count = schema.cypher_identifier(schema.PROP_TXN_COUNT)
    total_amount = schema.cypher_identifier(schema.PROP_TOTAL_AMOUNT)
    first_ts = schema.cypher_identifier(schema.PROP_FIRST_TIMESTAMP)
    last_ts = schema.cypher_identifier(schema.PROP_LAST_TIMESTAMP)
    weight = schema.cypher_identifier(schema.REL_WEIGHT_PROPERTY)
    txn_ids = schema.cypher_identifier(schema.PROP_TRANSACTION_IDS)
    query = f"""
    UNWIND $rows AS row
    MATCH (source:{person_label} {{{node_id}: row.source_id}})
    MATCH (target:{person_label} {{{node_id}: row.target_id}})
    CREATE (source)-[r:{rel_type}]->(target)
    SET r.{case_prop} = row.case_id, r.{txn_count} = row.transaction_count,
        r.{total_amount} = row.total_amount,
        r.{first_ts} = datetime(row.first_timestamp),
        r.{last_ts} = datetime(row.last_timestamp),
        r.{weight} = row.weight, r.{txn_ids} = row.transaction_ids
    """
    with driver.session() as session:
        for i in range(0, len(aggregated), 1000):
            session.run(query, rows=aggregated[i:i + 1000]).consume()


def project_person_graph(driver: Any) -> ProjectionSummary:
    rows = _resolved_transactions(driver)
    aggregated = _aggregate(rows)
    _delete_existing(driver)
    _write_edges(driver, aggregated)
    same_case = sum(1 for edge in aggregated if edge["case_id"] is not None)
    cross_case = sum(1 for edge in aggregated if edge["case_id"] is None)
    return ProjectionSummary(
        same_case_edges=same_case, cross_case_edges=cross_case, raw_transactions_used=len(rows)
    )


def main() -> None:
    argparse.ArgumentParser(
        description="Materialize the PERSON->TRANSACTED_WITH analytical projection"
    ).parse_args()
    with managed_driver() as driver:
        summary = project_person_graph(driver)
    print(
        f"TRANSACTED_WITH projected: {summary.same_case_edges} same-case, "
        f"{summary.cross_case_edges} cross-case, from {summary.raw_transactions_used} "
        f"resolved raw transactions"
    )


if __name__ == "__main__":
    main()
