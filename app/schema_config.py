"""Single source of truth for the Neo4j schema.

Two graphs live in Neo4j side by side:
  - The RAW heterogeneous graph (Person/Account/Phone/RecruiterPlatform/
    CryptoOfframp + TRANSACTION/RECRUITED_VIA/SHARED_ADDRESS/SHARED_DEVICE/
    OWNS), a faithful copy of dataset_generator/output/ for detailed
    inspection.
  - The PERSON-only analytical graph that every Zone 1 algorithm and API
    endpoint actually queries, via ``ENTITY_NODE_LABELS`` and
    ``STRUCTURAL_REL_TYPES`` below: Person nodes connected by TRANSACTED_WITH
    (a materialized, aggregated projection of Account-level TRANSACTION
    edges resolved through OWNS/linked_person_id — see
    app/project_person_graph.py) plus the already-Person-to-Person
    SHARED_ADDRESS/SHARED_DEVICE edges used directly, unmodified, from the
    raw graph.

If the analytical graph ever needs to span more labels, update
``ENTITY_NODE_LABELS``; every query builder already creates a label-union
predicate from that tuple via ``entity_label_predicate``.
"""
from __future__ import annotations

import re

# Node labels
NODE_LABEL_ENTITY = "Person"
ENTITY_NODE_LABELS = (NODE_LABEL_ENTITY,)
NODE_LABEL_CASE = "Case"
NODE_LABEL_CRITICALITY_RESULT = "CriticalityRank"
NODE_LABEL_CIRCULAR_FLOW_FLAG = "CircularFlowFlag"
NODE_LABEL_STRUCTURING_FLAG = "StructuringFlag"

# Raw-graph-only node labels (never part of ENTITY_NODE_LABELS/the analytical
# graph; reachable only via OWNS/RECRUITED_VIA for detail inspection).
RAW_NODE_LABEL_ACCOUNT = "Account"
RAW_NODE_LABEL_PHONE = "Phone"
RAW_NODE_LABEL_RECRUITER_PLATFORM = "RecruiterPlatform"
RAW_NODE_LABEL_CRYPTO_OFFRAMP = "CryptoOfframp"

# Entity and relationship properties
PROP_NODE_ID = "id"
PROP_NODE_NAME = "name"
PROP_CASE_ID = "case_id"
PROP_RELATIONSHIP_ID = "id"
PROP_ENTITY_TYPE = "entity_type"
PROP_FIRST_CONTACT_DATE = "first_contact_date"
PROP_IS_BACKGROUND_NOISE = "is_background_noise"
PROP_CASE_STATUS = "status"
PROP_CASE_PRIORITY = "priority"
PROP_CASE_DESCRIPTION = "description"
PROP_CASE_UPDATED_AT = "updated_at"
PROP_CASE_LEAD_ANALYST = "lead_analyst"
PROP_CASE_JURISDICTION_TAG = "jurisdiction_tag"
PROP_CASE_MODULARITY = "modularity"
PROP_CASE_DENSITY = "density"
PROP_CASE_DIAMETER = "diameter"
PROP_CASE_RECIPROCITY = "reciprocity"

# Relationship types
REL_TRANSACTION = "TRANSACTED_WITH"
REL_SHARED_ADDRESS = "SHARED_ADDRESS"
REL_SHARED_DEVICE = "SHARED_DEVICE"
REL_CASE_LINK = "BELONGS_TO"
STRUCTURAL_REL_TYPES = (REL_TRANSACTION, REL_SHARED_ADDRESS, REL_SHARED_DEVICE)
# Analytical edge types whose case scoping is one-sided (see
# repository.get_case_graph): a noise-side person has no case_id, so only
# the ring-side endpoint needs to resolve to the requested case.
ONE_SIDED_SCOPE_REL_TYPES = (REL_SHARED_ADDRESS, REL_SHARED_DEVICE)
REL_WEIGHT_PROPERTY = "weight"

# Raw-graph-only relationship types (never in STRUCTURAL_REL_TYPES).
# RAW_REL_TRANSACTION ("TRANSACTION", Account->Account) is intentionally
# distinct from REL_TRANSACTION ("TRANSACTED_WITH", the aggregated Person
# analytical edge above) - detect_financial_patterns.py's circular-flow and
# structuring detection need real per-transaction timestamps/amounts, which
# aggregation destroys, so those two loaders read this raw type directly
# (resolved to Person ids via OWNS) rather than the aggregated one.
RAW_REL_OWNS = "OWNS"
RAW_REL_RECRUITED_VIA = "RECRUITED_VIA"
RAW_REL_TRANSACTION = "TRANSACTION"

# TRANSACTED_WITH aggregation properties (see app/project_person_graph.py)
PROP_TXN_COUNT = "transaction_count"
PROP_TOTAL_AMOUNT = "total_amount"
PROP_FIRST_TIMESTAMP = "first_timestamp"
PROP_LAST_TIMESTAMP = "last_timestamp"
PROP_TRANSACTION_IDS = "transaction_ids"

# Financial relationship properties
TXN_PROP_AMOUNT = "amount"
TXN_PROP_TIMESTAMP = "timestamp"

# Algorithm output contract
PROP_BETWEENNESS = "betweenness_score"
PROP_EIGENVECTOR = "eigenvector_score"
PROP_DEGREE = "degree_score"
PROP_COMMUNITY_ID = "community_id"
PROP_COMMUNITY_SIZE = "community_size"
PROP_COMMUNITY_INTERNAL_DENSITY = "community_internal_density"
PROP_COMMUNITY_EXTERNAL_DENSITY = "community_external_density"
PROP_STRUCTURAL_ROLE = "structural_role"
REL_SIMILAR_TO = "SIMILAR_TO"
REL_SIMILAR_TO_SCORE_PROP = "score"

# Derived-result schema
REL_HAS_CRITICALITY_RESULT = "HAS_CRITICALITY_RESULT"
PROP_RESULT_RANK = "rank"
PROP_RESULT_NODE_ID = "node_id"
PROP_LARGEST_COMPONENT_BEFORE = "largest_component_before"
PROP_LARGEST_COMPONENT_AFTER = "largest_component_after"
PROP_NUM_COMPONENTS_AFTER = "num_components_after"
PROP_GLOBAL_EFFICIENCY_BEFORE = "global_efficiency_before"
PROP_GLOBAL_EFFICIENCY_AFTER = "global_efficiency_after"
PROP_BASELINE_NODE_COUNT = "baseline_node_count"
PROP_BASELINE_LARGEST_COMPONENT = "baseline_largest_component"
PROP_BASELINE_COMPONENT_COUNT = "baseline_component_count"

PROP_FLAG_ID = "flag_id"
PROP_FLAG_NODE_IDS = "node_ids"
PROP_FLAG_TOTAL_AMOUNT = "total_amount"
PROP_FLAG_CYCLE_LENGTH = "cycle_length"
PROP_FLAG_FROM_NODE = "from_node"
PROP_FLAG_TO_NODE = "to_node"
PROP_FLAG_TRANSACTION_COUNT = "transaction_count"
PROP_FLAG_WINDOW_START = "window_start"
PROP_FLAG_WINDOW_END = "window_end"

# Structural role thresholds
HUB_BETWEENNESS_PERCENTILE = 85
HUB_DEGREE_PERCENTILE = 85
BROKER_BETWEENNESS_PERCENTILE = 85
BROKER_DEGREE_PERCENTILE_MAX = 50

# Fragmentation simulation
CRITICALITY_CANDIDATE_POOL_SIZE = 20
CRITICALITY_DEFAULT_TOP_K = 10
PATH_MAX_HOPS = 15

# Financial-pattern rules (placeholders pending dataset calibration)
STRUCTURING_THRESHOLD_AMOUNT = 200_000
STRUCTURING_WINDOW_DAYS = 30
STRUCTURING_MIN_TRANSACTION_COUNT = 3
CIRCULAR_FLOW_MIN_LENGTH = 3
CIRCULAR_FLOW_MAX_LENGTH = 5

_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_PROJECTION_COMPONENT_PATTERN = re.compile(r"[^A-Za-z0-9_]")


def cypher_identifier(value: str) -> str:
    """Quote a trusted config identifier after rejecting unsafe characters."""
    if not _IDENTIFIER_PATTERN.fullmatch(value):
        raise ValueError(f"unsafe schema identifier: {value!r}")
    return f"`{value}`"


def entity_label_predicate(variable: str) -> str:
    """Return a Cypher predicate matching any configured entity label."""
    if not _IDENTIFIER_PATTERN.fullmatch(variable):
        raise ValueError(f"unsafe Cypher variable: {variable!r}")
    return "(" + " OR ".join(
        f"{variable}:{cypher_identifier(label)}" for label in ENTITY_NODE_LABELS
    ) + ")"


def relationship_type_union(types: tuple[str, ...] | list[str]) -> str:
    """Return a safe relationship-type union for a Cypher pattern."""
    return "|".join(cypher_identifier(value) for value in types)


def cypher_string_list(values: tuple[str, ...] | list[str]) -> str:
    """Return a safe Cypher list-of-string-literals, e.g. for `type(rel) IN [...]`.

    Reuses the same identifier validation as cypher_identifier (rejecting
    anything that isn't a plain identifier) even though the output here is
    quoted as a string literal, not a backtick-quoted identifier.
    """
    for value in values:
        if not _IDENTIFIER_PATTERN.fullmatch(value):
            raise ValueError(f"unsafe schema identifier: {value!r}")
    return "[" + ", ".join(f"'{value}'" for value in values) + "]"


def projection_name(case_id: str, directed: bool = False) -> str:
    suffix = "directed" if directed else "undirected"
    safe_case_id = _PROJECTION_COMPONENT_PATTERN.sub("_", case_id)
    if not safe_case_id:
        raise ValueError("case_id must contain at least one alphanumeric character")
    return f"case_{safe_case_id}_{suffix}"
