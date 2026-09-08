"""Detect and persist explainable circular-flow and structuring flags.

Transactions are raw Account->Account relationships (RAW_REL_TRANSACTION),
not the aggregated Person->Person TRANSACTED_WITH analytical edges -
aggregation destroys the individual timestamps/amounts this module's cycle
and structuring detectors need. load_case_transactions resolves each raw
transaction's endpoints to their owning Person via OWNS (excluding
self-transactions and CryptoOfframp-terminating ones, same as
project_person_graph.py), producing Person-keyed Transaction records so the
resulting flags' node_ids match what the Person-only analytical graph and
get_node_detail's alert-count lookup expect.

Circular-flow detection reuses detect_circular_flows (pure Python, DFS over
the same Transaction list structuring detection already loads) rather than a
separate raw Cypher path query: once each "hop" is really three raw
relationships (Person-OWNS->Account-TRANSACTION->Account<-OWNS-Person), a
single variable-length Cypher path mixing OWNS and TRANSACTION types becomes
fragile to express correctly, and there is no accuracy or semantic
difference from running the same already-tested algorithm in Python against
data already being loaded for structuring detection anyway.
"""
from __future__ import annotations

import argparse
import hashlib
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from . import schema_config as schema
from .database import distinct_case_ids, managed_driver
from .project_graphs import project_case_graph


@dataclass(frozen=True)
class Transaction:
    transaction_id: str
    source_id: str
    target_id: str
    amount: float
    timestamp: datetime


@dataclass(frozen=True)
class CircularFlowFlag:
    flag_id: str
    node_ids: tuple[str, ...]
    transaction_ids: tuple[str, ...]
    total_amount: float
    cycle_length: int


@dataclass(frozen=True)
class StructuringFlag:
    flag_id: str
    from_node: str
    to_node: str
    transaction_count: int
    total_amount: float
    window_start: datetime
    window_end: datetime


def _stable_id(prefix: str, values: tuple[str, ...]) -> str:
    digest = hashlib.sha256("|".join(values).encode()).hexdigest()[:20]
    return f"{prefix}:{digest}"


def _canonical_rotation(values: tuple[str, ...]) -> tuple[str, ...]:
    rotations = [values[index:] + values[:index] for index in range(len(values))]
    return min(rotations)


def detect_circular_flows(
    transactions: list[Transaction],
    minimum_length: int = schema.CIRCULAR_FLOW_MIN_LENGTH,
    maximum_length: int = schema.CIRCULAR_FLOW_MAX_LENGTH,
) -> list[CircularFlowFlag]:
    """Find directed simple cycles whose transaction timestamps strictly increase."""
    adjacency: dict[str, list[Transaction]] = defaultdict(list)
    for transaction in transactions:
        adjacency[transaction.source_id].append(transaction)
    for outgoing in adjacency.values():
        outgoing.sort(key=lambda item: (item.timestamp, item.transaction_id))

    found: dict[tuple[str, ...], CircularFlowFlag] = {}
    for start in sorted(adjacency):
        def walk(
            current: str,
            nodes: tuple[str, ...],
            path: tuple[Transaction, ...],
        ) -> None:
            if len(path) >= maximum_length:
                return
            for transaction in adjacency.get(current, []):
                if path and transaction.timestamp <= path[-1].timestamp:
                    continue
                if transaction.target_id == start:
                    cycle_length = len(path) + 1
                    if cycle_length < minimum_length:
                        continue
                    cycle_nodes = _canonical_rotation(nodes)
                    cycle_transactions = path + (transaction,)
                    transaction_ids = tuple(item.transaction_id for item in cycle_transactions)
                    found.setdefault(
                        cycle_nodes,
                        CircularFlowFlag(
                            flag_id=_stable_id("circular", cycle_nodes),
                            node_ids=cycle_nodes,
                            transaction_ids=transaction_ids,
                            total_amount=sum(item.amount for item in cycle_transactions),
                            cycle_length=cycle_length,
                        ),
                    )
                elif transaction.target_id not in nodes:
                    walk(
                        transaction.target_id,
                        nodes + (transaction.target_id,),
                        path + (transaction,),
                    )

        walk(start, (start,), ())
    return sorted(found.values(), key=lambda flag: flag.flag_id)


def detect_structuring(
    transactions: list[Transaction],
    threshold: float = schema.STRUCTURING_THRESHOLD_AMOUNT,
    minimum_count: int = schema.STRUCTURING_MIN_TRANSACTION_COUNT,
    window_days: int = schema.STRUCTURING_WINDOW_DAYS,
) -> list[StructuringFlag]:
    """Return one strongest rolling-window flag for each sender/receiver pair."""
    grouped: dict[tuple[str, str], list[Transaction]] = defaultdict(list)
    for transaction in transactions:
        if transaction.amount < threshold:
            grouped[(transaction.source_id, transaction.target_id)].append(transaction)
    flags: list[StructuringFlag] = []
    window = timedelta(days=window_days)
    for pair, items in sorted(grouped.items()):
        items.sort(key=lambda item: (item.timestamp, item.transaction_id))
        candidates: list[list[Transaction]] = []
        right = 0
        for left, first in enumerate(items):
            right = max(right, left)
            while right < len(items) and items[right].timestamp <= first.timestamp + window:
                right += 1
            candidate = items[left:right]
            if len(candidate) >= minimum_count:
                candidates.append(candidate)
        if not candidates:
            continue
        selected = max(
            candidates,
            key=lambda values: (len(values), sum(item.amount for item in values), -values[0].timestamp.timestamp()),
        )
        source, target = pair
        flags.append(
            StructuringFlag(
                flag_id=_stable_id("structuring", (source, target, selected[0].timestamp.isoformat())),
                from_node=source,
                to_node=target,
                transaction_count=len(selected),
                total_amount=sum(item.amount for item in selected),
                window_start=selected[0].timestamp,
                window_end=selected[-1].timestamp,
            )
        )
    return flags


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def load_case_transactions(driver: Any, case_id: str) -> list[Transaction]:
    """Reads raw, per-transaction Account-level TRANSACTION edges (not the
    aggregated TRANSACTED_WITH analytical edges - aggregation destroys the
    individual timestamps/amounts this detector needs) and resolves each
    endpoint to its owning Person via OWNS, so the flags this produces are
    keyed by Person id - matching the Person-only analytical graph and
    get_node_detail's alert-count lookup. Self-transactions (an account
    owned by the same person on both sides) are excluded, same as the
    TRANSACTED_WITH projection."""
    person_label = schema.cypher_identifier(schema.NODE_LABEL_ENTITY)
    account_label = schema.cypher_identifier(schema.RAW_NODE_LABEL_ACCOUNT)
    owns = schema.cypher_identifier(schema.RAW_REL_OWNS)
    relationship_type = schema.cypher_identifier(schema.RAW_REL_TRANSACTION)
    relationship_id = schema.cypher_identifier(schema.PROP_RELATIONSHIP_ID)
    node_id = schema.cypher_identifier(schema.PROP_NODE_ID)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    amount = schema.cypher_identifier(schema.TXN_PROP_AMOUNT)
    timestamp = schema.cypher_identifier(schema.TXN_PROP_TIMESTAMP)
    query = f"""
    MATCH (source:{person_label})-[:{owns}]->(:{account_label})-[transaction:{relationship_type}]->
          (:{account_label})<-[:{owns}]-(target:{person_label})
    WHERE source.{node_id} <> target.{node_id}
      AND source.{case_prop} = $case_id AND target.{case_prop} = $case_id
      AND transaction.{amount} IS NOT NULL AND transaction.{timestamp} IS NOT NULL
    RETURN coalesce(transaction.{relationship_id}, elementId(transaction)) AS transaction_id,
           source.{node_id} AS source_id, target.{node_id} AS target_id,
           toFloat(transaction.{amount}) AS amount, transaction.{timestamp} AS timestamp
    """
    with driver.session() as session:
        rows = list(session.run(query, case_id=case_id))
    return [
        Transaction(
            transaction_id=str(row["transaction_id"]),
            source_id=row["source_id"],
            target_id=row["target_id"],
            amount=float(row["amount"]),
            timestamp=_as_datetime(row["timestamp"]),
        )
        for row in rows
    ]


def persist_financial_flags(
    driver: Any,
    case_id: str,
    circular_flags: list[CircularFlowFlag],
    structuring_flags: list[StructuringFlag],
) -> None:
    circular_label = schema.cypher_identifier(schema.NODE_LABEL_CIRCULAR_FLOW_FLAG)
    structuring_label = schema.cypher_identifier(schema.NODE_LABEL_STRUCTURING_FLAG)
    case_prop = schema.cypher_identifier(schema.PROP_CASE_ID)
    flag_id = schema.cypher_identifier(schema.PROP_FLAG_ID)
    node_ids = schema.cypher_identifier(schema.PROP_FLAG_NODE_IDS)
    total_amount = schema.cypher_identifier(schema.PROP_FLAG_TOTAL_AMOUNT)
    cycle_length = schema.cypher_identifier(schema.PROP_FLAG_CYCLE_LENGTH)
    from_node = schema.cypher_identifier(schema.PROP_FLAG_FROM_NODE)
    to_node = schema.cypher_identifier(schema.PROP_FLAG_TO_NODE)
    transaction_count = schema.cypher_identifier(schema.PROP_FLAG_TRANSACTION_COUNT)
    window_start = schema.cypher_identifier(schema.PROP_FLAG_WINDOW_START)
    window_end = schema.cypher_identifier(schema.PROP_FLAG_WINDOW_END)
    delete_query = f"""
    MATCH (flag) WHERE (flag:{circular_label} OR flag:{structuring_label})
      AND flag.{case_prop} = $case_id
    DETACH DELETE flag
    """
    circular_query = f"""
    UNWIND $rows AS row
    CREATE (flag:{circular_label})
    SET flag.{flag_id} = row.flag_id, flag.{case_prop} = $case_id,
        flag.{node_ids} = row.node_ids, flag.{total_amount} = row.total_amount,
        flag.{cycle_length} = row.cycle_length
    """
    structuring_query = f"""
    UNWIND $rows AS row
    CREATE (flag:{structuring_label})
    SET flag.{flag_id} = row.flag_id, flag.{case_prop} = $case_id,
        flag.{from_node} = row.from_node, flag.{to_node} = row.to_node,
        flag.{transaction_count} = row.transaction_count,
        flag.{total_amount} = row.total_amount,
        flag.{window_start} = row.window_start,
        flag.{window_end} = row.window_end
    """
    circular_rows = [
        {**asdict(flag), "node_ids": list(flag.node_ids)} for flag in circular_flags
    ]
    structuring_rows = [
        {
            **asdict(flag),
            "window_start": flag.window_start.isoformat(),
            "window_end": flag.window_end.isoformat(),
        }
        for flag in structuring_flags
    ]
    with driver.session() as session:
        session.run(delete_query, case_id=case_id).consume()
        session.run(circular_query, case_id=case_id, rows=circular_rows).consume()
        session.run(structuring_query, case_id=case_id, rows=structuring_rows).consume()


def detect_financial_patterns(
    driver: Any, case_id: str
) -> tuple[list[CircularFlowFlag], list[StructuringFlag]]:
    project_case_graph(driver, case_id, directed=True)
    transactions = load_case_transactions(driver, case_id)
    circular = detect_circular_flows(transactions)
    structuring = detect_structuring(transactions)
    persist_financial_flags(driver, case_id, circular, structuring)
    return circular, structuring


def main() -> None:
    parser = argparse.ArgumentParser(description="Precompute deterministic financial flags")
    parser.add_argument("case_id", nargs="?", help="One case; defaults to every discovered case")
    args = parser.parse_args()
    with managed_driver() as driver:
        case_ids = [args.case_id] if args.case_id else distinct_case_ids(driver)
        for case_id in case_ids:
            circular, structuring = detect_financial_patterns(driver, case_id)
            print(
                f"Financial detection complete for {case_id}: "
                f"{len(circular)} circular flows, {len(structuring)} structuring flags"
            )


if __name__ == "__main__":
    main()
