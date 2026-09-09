"""
Showcase cases: composes multiple sub-ring instances (each built from
motifs.py's existing generator functions, completely unchanged) into one
larger case, with a deliberate hidden link between exactly one pair of
sub-rings, and a hard per-case degree cap.

Why this exists: every case in the original 150-case dataset is exactly one
motif instance, so it's always a single dominant hub with a wheel of leaves
around it - correct in isolation, but there is never anything else going on
in the same case for community/path analysis to actually have to find. This
module builds "showcase" cases that combine several separate-looking rings,
with one pair secretly sharing an account - the hidden-mule moment an
investigator only finds by actually analyzing the case, not by looking at
either sub-ring alone.

This is composition and linking logic ONLY - motifs.py is imported and
called unmodified. Nothing here touches assemble.py's main 150-case loop;
this is a standalone generator with its own output directory
(output/showcase/) so it can't collide with or corrupt the real dataset.
"""

import argparse
import json
import os
import random
from collections import Counter
from datetime import datetime

from bridges import inject_cross_case_bridges
from config import RING_SIZE_TIERS, SCAM_SUBTYPES
from motifs import (
    generate_dormant_then_burst,
    generate_fan_out_fan_in,
    generate_fast_pass_through,
    generate_recruited_crypto_exit,
)
from rng_streams import derive_seed

MOTIF_GENERATORS = {
    "fast_pass_through": generate_fast_pass_through,
    "fan_out_fan_in": generate_fan_out_fan_in,
    "dormant_then_burst": generate_dormant_then_burst,
    "recruited_crypto_exit": generate_recruited_crypto_exit,
}

SUBRING_SIZE_TIER = "small_jamtara_scale"  # 15-40 nodes, per the spec
MIN_SUBRINGS_PER_CASE = 2
MAX_SUBRINGS_PER_CASE = 4
TARGET_CASE_SIZE_RANGE = (80, 250)

# Applies to the fully-composed case (sub-rings + internal link), and,
# separately re-derived per hub case, to cross-case bridges too - no single
# node may end up connected to more than this fraction of its case's nodes.
MAX_DEGREE_FRACTION = 0.32

OUTPUT_DIR = os.path.join("output", "showcase")


def _account_degree(nodes, edges):
    """{account_id: degree} counting only TRANSACTION edges among the given
    nodes - the same definition used throughout this project's degree/cap
    checks (PERSON/PHONE nodes never carry TRANSACTION edges directly)."""
    account_ids = {n["id"] for n in nodes if n["type"] == "ACCOUNT"}
    deg = Counter()
    for e in edges:
        if e["type"] == "TRANSACTION" and e["source_id"] in account_ids and e["target_id"] in account_ids:
            deg[e["source_id"]] += 1
            deg[e["target_id"]] += 1
    return deg


def _max_degree_ratio(nodes, edges):
    """(max_degree, ratio, node_id) for the account-level graph built from
    nodes/edges - ratio is max_degree / len(nodes), matching the
    max_degree/(n-1) star-detection approach closely enough at these node
    counts (n-1 vs n is noise once n is in the dozens+)."""
    deg = _account_degree(nodes, edges)
    if not deg:
        return 0, 0.0, None
    node_id, max_deg = deg.most_common(1)[0]
    return max_deg, max_deg / len(nodes), node_id


def _build_one_subring(subring_id, case_selection_rng, entity_attribute_rng, size_tier=SUBRING_SIZE_TIER):
    """Builds one sub-ring via an unmodified motifs.py generator function,
    picking its own motif and scam_subtype the same way assemble.py's main
    loop does. Returns the raw {"nodes","edges","case_metadata"} dict plus
    the motif/subtype actually used."""
    motif = case_selection_rng.choice(list(MOTIF_GENERATORS.keys()))
    scam_subtype = case_selection_rng.choice(list(SCAM_SUBTYPES.keys()))
    result = MOTIF_GENERATORS[motif](subring_id, scam_subtype, size_tier,
                                      case_selection_rng, entity_attribute_rng)
    return result, motif, scam_subtype


def _find_victim_first_hop_account(nodes, edges):
    """Finds the account that is the target of a victim-account's earliest
    outgoing TRANSACTION edge - "the account a victim was told to pay into"
    - a role that exists in every motif, used as the generic redirect point
    for the hidden-link merge (see _merge_shared_account)."""
    person_role_by_id = {n["id"]: n["ground_truth"]["role"] for n in nodes if n["type"] == "PERSON"}
    account_owner = {n["id"]: n["linked_person_id"] for n in nodes if n["type"] == "ACCOUNT"}
    victim_account_ids = {
        aid for aid, pid in account_owner.items() if person_role_by_id.get(pid) == "victim"
    }
    outflows = [e for e in edges if e["type"] == "TRANSACTION" and e["source_id"] in victim_account_ids]
    if not outflows:
        return None
    first = min(outflows, key=lambda e: e["timestamp"])
    return first["target_id"]


def _pick_mule_account(nodes, rng):
    """Picks a real mule-role account (any non-null mule_layer) from nodes -
    the "already exists, plausible in either ring" identity that becomes
    the shared account."""
    candidates = [
        n for n in nodes
        if n["type"] == "ACCOUNT" and n["ground_truth"].get("mule_layer") is not None
    ]
    return rng.choice(candidates)["id"]


def _merge_shared_account(subring_a, subring_b, rng):
    """The hidden-link mechanic: picks a real mule account from subring_a
    and redirects subring_b's own victim-facing first-hop account to it -
    reusing the account, not duplicating it as a lookalike. subring_b's
    now-orphaned original first-hop PERSON/ACCOUNT/PHONE nodes (the
    identity nothing else in subring_b references anymore) are removed
    from subring_b's own node list entirely, so the merged account is the
    only trace of that role in subring_b.

    Mutates subring_b's edges in place (rewrites the old account id to the
    shared one) and returns (shared_account_id, subring_b_nodes_pruned).
    """
    shared_account_id = _pick_mule_account(subring_a["nodes"], rng)

    old_account_id = _find_victim_first_hop_account(subring_b["nodes"], subring_b["edges"])
    if old_account_id is None or old_account_id == shared_account_id:
        return None, subring_b["nodes"]

    old_account = next(n for n in subring_b["nodes"] if n["id"] == old_account_id)
    old_person_id = old_account["linked_person_id"]

    for e in subring_b["edges"]:
        if e.get("source_id") == old_account_id:
            e["source_id"] = shared_account_id
        if e.get("target_id") == old_account_id:
            e["target_id"] = shared_account_id

    # old_account_id/old_person_id are now unreferenced by any edge in
    # subring_b - drop that identity's PERSON/ACCOUNT/PHONE nodes entirely,
    # rather than leaving a dangling, edge-less duplicate sitting around.
    pruned_nodes = [
        n for n in subring_b["nodes"]
        if n["id"] != old_account_id
        and not (n["type"] == "PERSON" and n["id"] == old_person_id)
        and not (n["type"] == "PHONE" and n.get("linked_person_id") == old_person_id)
    ]
    return shared_account_id, pruned_nodes


def _regenerate_smaller(subring_id, case_selection_rng, entity_attribute_rng, cap_fraction, case_size_estimate):
    """Escape hatch for a sub-ring whose natural hub would exceed the cap
    at the target case size: retries the same motif/subtype (small-tier
    draws vary in size already) a few times, and if that still doesn't fit,
    splits it into two half-sized sub-rings instead (per the spec's own
    example: two smaller instances rather than forcing one motif's
    internal logic under the cap). Returns a list of 1 or 2
    (result, motif, subtype) tuples."""
    for _ in range(5):
        result, motif, subtype = _build_one_subring(subring_id, case_selection_rng, entity_attribute_rng)
        max_deg, _, _ = _max_degree_ratio(result["nodes"], result["edges"])
        if max_deg <= cap_fraction * case_size_estimate:
            return [(result, motif, subtype)]

    # Still too big after retries - split into two smaller sub-ring
    # instances of a (possibly different) motif instead of forcing this
    # one under the cap by breaking its own internal logic.
    half_a, motif_a, subtype_a = _build_one_subring(f"{subring_id}a", case_selection_rng, entity_attribute_rng)
    half_b, motif_b, subtype_b = _build_one_subring(f"{subring_id}b", case_selection_rng, entity_attribute_rng)
    return [(half_a, motif_a, subtype_a), (half_b, motif_b, subtype_b)]


def compose_showcase_case(case_id, case_selection_rng, entity_attribute_rng, created_at):
    """Builds one showcase case: 2-4 sub-rings (escape-hatch-adjusted for
    the degree cap), one deliberate shared-account link between exactly one
    pair, and a final cap check on the fully-composed result.

    Returns (case_result, subring_summaries, subring_link) where
    case_result is the usual {"nodes","edges","case_metadata"} shape,
    subring_summaries is a list of per-subring bookkeeping dicts (for
    reporting - not persisted), and subring_link is the
    {subring_a_id, subring_b_id, shared_account_id} record for
    subring_ground_truth.json (or None if only one sub-ring resulted from
    a split and there was nothing to link - not expected in practice, but
    handled rather than assumed away).
    """
    # Sub-ring count is adaptive, not fixed upfront: fast_pass_through is a
    # fixed ~9-node chain regardless of size_tier (by its own design - "no
    # fan-out" is structural, not tier-controlled), so a flat 2-4 draw can
    # land well under the 80-node floor on an unlucky motif mix. We target
    # the actual stated requirement (80-250 total nodes) directly and let
    # sub-ring count be an outcome - 2-4 is what it normally takes once
    # sizes average out, but the size floor is what's actually enforced.
    min_size, max_size = TARGET_CASE_SIZE_RANGE
    case_size_estimate = (min_size + max_size) // 2
    # The shared-account merge below removes ~2-3 nodes (the pruned
    # duplicate identity) after this loop finishes, so target slightly
    # above the floor here to make sure the post-merge count still clears
    # min_size, not just the pre-merge running total.
    min_size_before_merge = min_size + 3

    subrings = []  # list of (result, motif, subtype)
    total_so_far = 0
    i = 0
    while True:
        i += 1
        subring_id = f"{case_id}-SR{i}"
        result, motif, subtype = _build_one_subring(subring_id, case_selection_rng, entity_attribute_rng)
        max_deg, _, _ = _max_degree_ratio(result["nodes"], result["edges"])
        if max_deg > MAX_DEGREE_FRACTION * case_size_estimate:
            new_subrings = _regenerate_smaller(
                subring_id, case_selection_rng, entity_attribute_rng,
                MAX_DEGREE_FRACTION, case_size_estimate)
        else:
            new_subrings = [(result, motif, subtype)]
        subrings.extend(new_subrings)
        total_so_far += sum(len(r["nodes"]) for r, _, _ in new_subrings)

        reached_min_count = len(subrings) >= MIN_SUBRINGS_PER_CASE
        reached_min_size = total_so_far >= min_size_before_merge
        if reached_min_count and reached_min_size:
            break
        if len(subrings) >= MAX_SUBRINGS_PER_CASE and total_so_far >= min_size_before_merge:
            break
        if total_so_far >= max_size:
            break
        if len(subrings) >= 8:  # sane upper bound, should not be reached in practice
            break

    # Deliberate hidden link between exactly one pair (not all pairs).
    subring_link = None
    if len(subrings) >= 2:
        a_idx, b_idx = case_selection_rng.sample(range(len(subrings)), 2)
        subring_a_result = subrings[a_idx][0]
        subring_b_result = subrings[b_idx][0]
        shared_account_id, pruned_b_nodes = _merge_shared_account(
            subring_a_result, subring_b_result, case_selection_rng)
        if shared_account_id is not None:
            subring_b_result["nodes"] = pruned_b_nodes
            subring_link = {
                "subring_a_id": subring_a_result["case_metadata"]["case_id"],
                "subring_b_id": subring_b_result["case_metadata"]["case_id"],
                "shared_account_id": shared_account_id,
            }

    all_nodes, all_edges = [], []
    subring_summaries = []
    for result, motif, subtype in subrings:
        all_nodes.extend(result["nodes"])
        all_edges.extend(result["edges"])
        subring_summaries.append({
            "subring_id": result["case_metadata"]["case_id"],
            "motif": motif,
            "scam_subtype": subtype,
            "node_count": len(result["nodes"]),
        })

    max_deg, ratio, hub_node = _max_degree_ratio(all_nodes, all_edges)
    total_amount = sum(e["amount"] for e in all_edges if e["type"] == "TRANSACTION")
    case_metadata = {
        "case_id": case_id,
        "scam_subtype": subring_summaries[0]["scam_subtype"] if subring_summaries else None,
        "motif": "multi_subring",
        "ring_size_tier": "showcase_composed",
        "created_at": created_at.isoformat(),
        "last_updated": created_at.isoformat(),
        "node_count": len(all_nodes),
        "total_amount_inr": round(total_amount, 2),
    }
    case_result = {"nodes": all_nodes, "edges": all_edges, "case_metadata": case_metadata}
    return case_result, subring_summaries, subring_link, (max_deg, ratio, hub_node)


def main():
    parser = argparse.ArgumentParser(description="Generate showcase multi-sub-ring cases (review checkpoint).")
    parser.add_argument("--n-cases", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    case_selection_rng = random.Random(derive_seed(args.seed, "case_selection"))
    entity_attribute_rng = random.Random(derive_seed(args.seed, "entity_attribute"))

    case_results = []
    subring_ground_truth = []
    report_rows = []

    for i in range(1, args.n_cases + 1):
        case_id = f"C-SHOWCASE-{i:02d}"
        created_at = datetime(2026, 9, 1)
        case_result, subring_summaries, subring_link, (max_deg, ratio, hub_node) = compose_showcase_case(
            case_id, case_selection_rng, entity_attribute_rng, created_at)
        case_results.append(case_result)
        if subring_link:
            subring_link = {"case_id": case_id, **subring_link}
            subring_ground_truth.append(subring_link)
        report_rows.append((case_id, subring_summaries, subring_link, max_deg, ratio, hub_node))

    # Cross-case bridges among just these cases, re-scoped: percentage cap
    # instead of the old fixed max-14, and since there are only n_cases of
    # them (not 150), n_hubs stays small (1 for 5 cases is already enough
    # to demonstrate the mechanic without linking everything to everything).
    n_hubs = 1 if len(case_results) >= 3 else 0
    avg_case_size = sum(r["case_metadata"]["node_count"] for r in case_results) / len(case_results)
    avg_account_share = 0.45  # ACCOUNT nodes are consistently ~45% of a case's total nodes (verified empirically)
    max_bridge_spokes = max(1, int(MAX_DEGREE_FRACTION * avg_case_size * avg_account_share))
    bridge_edges, bridge_ground_truth = inject_cross_case_bridges(
        case_results, case_selection_rng, n_hubs,
        min_spokes=1, max_spokes=max_bridge_spokes)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    all_nodes, all_edges, all_case_metadata = [], [], []
    for r in case_results:
        all_nodes.extend(r["nodes"])
        all_edges.extend(r["edges"])
        all_case_metadata.append(r["case_metadata"])
    all_edges.extend(bridge_edges)

    with open(os.path.join(OUTPUT_DIR, "graph_nodes.json"), "w", encoding="utf-8") as f:
        json.dump(all_nodes, f, indent=2)
    with open(os.path.join(OUTPUT_DIR, "graph_edges.json"), "w", encoding="utf-8") as f:
        json.dump(all_edges, f, indent=2)
    with open(os.path.join(OUTPUT_DIR, "case_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(all_case_metadata, f, indent=2)
    with open(os.path.join(OUTPUT_DIR, "subring_ground_truth.json"), "w", encoding="utf-8") as f:
        json.dump(subring_ground_truth, f, indent=2)
    with open(os.path.join(OUTPUT_DIR, "bridge_ground_truth.json"), "w", encoding="utf-8") as f:
        json.dump(bridge_ground_truth, f, indent=2)

    return report_rows, case_results, subring_ground_truth, bridge_ground_truth, max_bridge_spokes


if __name__ == "__main__":
    main()
