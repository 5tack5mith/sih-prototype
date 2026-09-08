"""Ingest dataset_generator/output/ into Neo4j as the raw heterogeneous graph.

Reads graph_nodes.json, graph_edges.json, and case_metadata.json (never
modifies them — read-only) and loads:

  - Person / Account / Phone / RecruiterPlatform / CryptoOfframp nodes, with
    each entity's ``visible`` block flattened onto the node. ``ground_truth``
    is deliberately never read from the source files by this module and
    therefore never reaches Neo4j — see dataset_generator/README.md's
    "ground_truth is NOT stripped from graph_nodes.json" section: this
    script is the strip step.
  - TRANSACTION (Account->Account), RECRUITED_VIA (RecruiterPlatform->Person),
    SHARED_ADDRESS/SHARED_DEVICE (Person->Person) relationships, copied
    faithfully from the source edges.
  - OWNS (Person->Account, Person->Phone), synthesized from each Account's/
    Phone's ``linked_person_id`` — not present in the source data as a graph
    edge, only as an attribute.
  - Case nodes, one per case_metadata.json entry.

Case membership is positional, replicating fir_generator.build_case_indices'
verified contract (dataset_generator/README.md; independently re-verified
against total_amount_inr during the architecture review): case_metadata.json
entries are consumed in order, each claiming the next meta["node_count"]
nodes from graph_nodes.json. Nodes past the last case's slice are the
background-noise layer and get is_background_noise=true and no case_id
instead. An edge belongs to a case only when the case-scoped ingestion step
that follows (project_person_graph.py) resolves both endpoints to it -
nothing here stamps a case_id onto edges.

This script replaces whatever is currently in Neo4j (including the disposable
TOY-CASE-01/02 placeholder data) rather than merging with it.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from . import schema_config as schema
from .database import managed_driver

DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset_generator" / "output"
BATCH_SIZE = 1000


def _load_dataset() -> tuple[list[dict], list[dict], list[dict]]:
    with open(DATASET_DIR / "graph_nodes.json", encoding="utf-8") as f:
        nodes = json.load(f)
    with open(DATASET_DIR / "graph_edges.json", encoding="utf-8") as f:
        edges = json.load(f)
    with open(DATASET_DIR / "case_metadata.json", encoding="utf-8") as f:
        case_metadata = json.load(f)
    return nodes, edges, case_metadata


def _assign_case_ids(nodes: list[dict], case_metadata: list[dict]) -> dict[str, str | None]:
    """Positional case-membership slicing — see module docstring.

    Returns {node_id: case_id or None (None = background noise)}.
    """
    case_id_by_node: dict[str, str | None] = {}
    cursor = 0
    for meta in case_metadata:
        n = meta["node_count"]
        for node in nodes[cursor:cursor + n]:
            case_id_by_node[node["id"]] = meta["case_id"]
        cursor += n
    for node in nodes[cursor:]:
        case_id_by_node[node["id"]] = None
    return case_id_by_node


def _batches(rows: list[dict], size: int = BATCH_SIZE):
    for i in range(0, len(rows), size):
        yield rows[i:i + size]


def wipe_graph(driver: Any) -> None:
    """Delete everything currently in Neo4j (old placeholder data included)."""
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n").consume()


def load_cases(driver: Any, case_metadata: list[dict]) -> int:
    case_label = schema.cypher_identifier(schema.NODE_LABEL_CASE)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
    status = schema.cypher_identifier(schema.PROP_CASE_STATUS)
    description = schema.cypher_identifier(schema.PROP_CASE_DESCRIPTION)
    updated = schema.cypher_identifier(schema.PROP_CASE_UPDATED_AT)
    rows = []
    for meta in case_metadata:
        subtype = meta["scam_subtype"].replace("_", " ").title()
        motif = meta["motif"].replace("_", " ").title()
        tier = meta["ring_size_tier"].replace("_", " ")
        rows.append({
            "case_id": meta["case_id"],
            "name": f"{meta['case_id']}: {subtype}",
            "description": (
                f"{motif} ring ({tier}), {meta['node_count']} entities, "
                f"total flagged amount ₹{meta['total_amount_inr']:,.2f}"
            ),
            "updated_at": meta["last_updated"],
        })
    query = f"""
    UNWIND $rows AS row
    CREATE (case:{case_label})
    SET case.{node_id} = row.case_id, case.{node_name} = row.name,
        case.{status} = 'ACTIVE', case.{description} = row.description,
        case.{updated} = datetime(row.updated_at)
    """
    with driver.session() as session:
        for batch in _batches(rows):
            session.run(query, rows=batch).consume()
    return len(rows)


_RAW_LABEL_BY_TYPE = {
    "PERSON": schema.NODE_LABEL_ENTITY,
    "ACCOUNT": schema.RAW_NODE_LABEL_ACCOUNT,
    "PHONE": schema.RAW_NODE_LABEL_PHONE,
    "RECRUITER_PLATFORM": schema.RAW_NODE_LABEL_RECRUITER_PLATFORM,
    "CRYPTO_OFFRAMP": schema.RAW_NODE_LABEL_CRYPTO_OFFRAMP,
}


def load_nodes(driver: Any, nodes: list[dict], case_id_by_node: dict[str, str | None]) -> dict[str, int]:
    """Create every raw node, flattening `visible` onto it. `ground_truth` is
    never read from `node` by this function - it simply isn't in the
    dict comprehension below, so it never reaches Neo4j."""
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    node_name = schema.cypher_identifier(schema.PROP_NODE_NAME)
    entity_type = schema.cypher_identifier(schema.PROP_ENTITY_TYPE)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    noise_prop = schema.cypher_identifier(schema.PROP_IS_BACKGROUND_NOISE)

    by_type: dict[str, list[dict]] = {}
    for node in nodes:
        by_type.setdefault(node["type"], []).append(node)

    counts: dict[str, int] = {}
    with driver.session() as session:
        for node_type, type_nodes in by_type.items():
            label = schema.cypher_identifier(_RAW_LABEL_BY_TYPE[node_type])
            rows = []
            for node in type_nodes:
                case_id = case_id_by_node[node["id"]]
                rows.append({
                    "id": node["id"],
                    "name": node.get("canonical_name"),
                    "entity_type": node_type,
                    "case_id": case_id,
                    "is_noise": case_id is None,
                    "visible": node.get("visible", {}),
                })
            query = f"""
            UNWIND $rows AS row
            CREATE (n:{label})
            SET n.{node_id} = row.id, n.{node_name} = row.name,
                n.{entity_type} = row.entity_type,
                n.{case_prop} = row.case_id,
                n.{noise_prop} = row.is_noise,
                n += row.visible
            """
            for batch in _batches(rows):
                session.run(query, rows=batch).consume()
            counts[node_type] = len(type_nodes)
    return counts


def load_transaction_edges(driver: Any, edges: list[dict]) -> int:
    """Raw TRANSACTION edges, faithfully copied. Source is always an Account;
    target is usually an Account but is a CryptoOfframp for the final hop of
    a recruited_crypto_exit case (verified against motifs.py) - so nodes are
    matched by id alone, without a label constraint (ids are globally unique
    across every entity type, per assemble.py's own duplicate-id sanity
    check), rather than assuming both sides are Account and silently
    dropping the 38 crypto-conversion transactions.

    A synthetic sequential id is assigned (the source dataset has none) so
    later stages (repository.get_node_detail's ego_network, and
    project_person_graph.py's transaction_ids back-pointers) have something
    stable to reference."""
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    relationship_id = schema.cypher_identifier(schema.PROP_RELATIONSHIP_ID)
    amount = schema.cypher_identifier(schema.TXN_PROP_AMOUNT)
    timestamp = schema.cypher_identifier(schema.TXN_PROP_TIMESTAMP)
    transactions = [e for e in edges if e["type"] == "TRANSACTION"]
    rows = []
    for i, e in enumerate(transactions):
        rows.append({
            "id": f"TXN-{i + 1:06d}",
            "source_id": e["source_id"],
            "target_id": e["target_id"],
            "amount": e["amount"],
            "timestamp": e["timestamp"],
            "channel": e.get("channel"),
            "computed_weight": e.get("computed_weight"),
        })
    query = f"""
    UNWIND $rows AS row
    MATCH (source {{{node_id}: row.source_id}})
    MATCH (target {{{node_id}: row.target_id}})
    CREATE (source)-[t:TRANSACTION]->(target)
    SET t.{relationship_id} = row.id, t.{amount} = row.amount,
        t.{timestamp} = datetime(row.timestamp), t.channel = row.channel,
        t.computed_weight = row.computed_weight
    """
    with driver.session() as session:
        for batch in _batches(rows):
            session.run(query, rows=batch).consume()
    return len(rows)


def load_recruited_via_edges(driver: Any, edges: list[dict]) -> int:
    platform_label = schema.cypher_identifier(schema.RAW_NODE_LABEL_RECRUITER_PLATFORM)
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    rows = [
        {"source_id": e["source_id"], "target_id": e["target_id"], "timestamp": e["timestamp"]}
        for e in edges if e["type"] == "RECRUITED_VIA"
    ]
    query = f"""
    UNWIND $rows AS row
    MATCH (source:{platform_label} {{{node_id}: row.source_id}})
    MATCH (target:{person_label} {{{node_id}: row.target_id}})
    CREATE (source)-[r:RECRUITED_VIA]->(target)
    SET r.timestamp = datetime(row.timestamp)
    """
    with driver.session() as session:
        for batch in _batches(rows):
            session.run(query, rows=batch).consume()
    return len(rows)


def load_shared_edges(driver: Any, edges: list[dict]) -> dict[str, int]:
    """SHARED_ADDRESS/SHARED_DEVICE - already Person->Person in the source
    data (noise.py links noise-person ids directly to ring-person ids), so
    no Account-mediated resolution is needed."""
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    counts: dict[str, int] = {}
    for edge_type in ("SHARED_ADDRESS", "SHARED_DEVICE"):
        rows = [
            {"source_id": e["source_id"], "target_id": e["target_id"], "confidence": e.get("confidence")}
            for e in edges if e["type"] == edge_type
        ]
        rel = schema.cypher_identifier(edge_type)
        query = f"""
        UNWIND $rows AS row
        MATCH (source:{person_label} {{{node_id}: row.source_id}})
        MATCH (target:{person_label} {{{node_id}: row.target_id}})
        CREATE (source)-[r:{rel}]->(target)
        SET r.confidence = row.confidence
        """
        with driver.session() as session:
            for batch in _batches(rows):
                session.run(query, rows=batch).consume()
        counts[edge_type] = len(rows)
    return counts


def load_owns_edges(driver: Any, nodes: list[dict]) -> dict[str, int]:
    """Synthesize Person->Account and Person->Phone OWNS edges from
    linked_person_id - not a graph edge in the source data, only an
    attribute there."""
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    owns = schema.cypher_identifier(schema.RAW_REL_OWNS)
    counts: dict[str, int] = {}
    for node_type, label_const in (("ACCOUNT", schema.RAW_NODE_LABEL_ACCOUNT), ("PHONE", schema.RAW_NODE_LABEL_PHONE)):
        label = schema.cypher_identifier(label_const)
        rows = [
            {"person_id": n["linked_person_id"], "owned_id": n["id"]}
            for n in nodes if n["type"] == node_type and n.get("linked_person_id")
        ]
        query = f"""
        UNWIND $rows AS row
        MATCH (person:{person_label} {{{node_id}: row.person_id}})
        MATCH (owned:{label} {{{node_id}: row.owned_id}})
        CREATE (person)-[:{owns}]->(owned)
        """
        with driver.session() as session:
            for batch in _batches(rows):
                session.run(query, rows=batch).consume()
        counts[node_type] = len(rows)
    return counts


def ingest(driver: Any) -> dict[str, Any]:
    nodes, edges, case_metadata = _load_dataset()
    case_id_by_node = _assign_case_ids(nodes, case_metadata)

    wipe_graph(driver)
    case_count = load_cases(driver, case_metadata)
    node_counts = load_nodes(driver, nodes, case_id_by_node)
    transaction_count = load_transaction_edges(driver, edges)
    recruited_via_count = load_recruited_via_edges(driver, edges)
    shared_counts = load_shared_edges(driver, edges)
    owns_counts = load_owns_edges(driver, nodes)

    return {
        "cases": case_count,
        "nodes_by_type": node_counts,
        "transaction_edges": transaction_count,
        "recruited_via_edges": recruited_via_count,
        "shared_edges": shared_counts,
        "owns_edges": owns_counts,
    }


def main() -> None:
    argparse.ArgumentParser(description="Ingest dataset_generator/output/ into Neo4j").parse_args()
    with managed_driver() as driver:
        summary = ingest(driver)
    print("Ingestion complete:")
    for key, value in summary.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
