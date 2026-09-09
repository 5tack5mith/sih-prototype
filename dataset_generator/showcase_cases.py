"""
Showcase cases: composes multiple sub-ring instances (each built from
motifs.py's existing generator functions, completely unchanged) into one
larger case, with deliberate hidden shared-account links connecting every
sub-ring into one structure (not just one designated pair), and a hard
per-case degree cap.

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
import copy
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


def _pick_mule_account(nodes, used_ids, rng, prefer_victim_first_hop_edges=None):
    """Picks a real mule-role account (any non-null mule_layer) from nodes
    that hasn't already been used as a shared-link endpoint in this
    sub-ring - the "already exists, plausible in this ring" identity that
    becomes (or receives) a shared account. Generalized beyond just "the
    victim's first hop" (the original single-link design) so a sub-ring can
    supply or receive several distinct shared-account links without
    reusing the same account twice."""
    candidates = [
        n for n in nodes
        if n["type"] == "ACCOUNT" and n["ground_truth"].get("mule_layer") is not None
        and n["id"] not in used_ids
    ]
    if not candidates:
        return None
    return rng.choice(candidates)["id"]


def _merge_shared_account(subring_a, subring_b, used_a, used_b, rng):
    """The hidden-link mechanic: picks a real, not-yet-used mule account
    from subring_a and redirects one of subring_b's own not-yet-used mule
    accounts to it - reusing the account, not duplicating it as a
    lookalike. subring_b's now-orphaned original account's PERSON/ACCOUNT/
    PHONE nodes (the identity nothing else in subring_b references
    anymore) are removed from subring_b's own node list entirely, so the
    merged account is the only trace of that role in subring_b.

    used_a/used_b are the sets of account ids already spent as shared-link
    endpoints in each sub-ring (mutated in place on success) - this is what
    lets a single sub-ring participate in several distinct links (up to
    its number of real mule accounts) without ever reusing one account for
    two different links.

    Mutates subring_b's edges in place (rewrites the old account id to the
    shared one) and returns (shared_account_id, subring_b_nodes_pruned), or
    (None, subring_b["nodes"]) if either side has no account left to give.
    """
    shared_account_id = _pick_mule_account(subring_a["nodes"], used_a, rng)
    if shared_account_id is None:
        return None, subring_b["nodes"]

    old_account_id = _pick_mule_account(subring_b["nodes"], used_b, rng)
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
    used_a.add(shared_account_id)
    used_b.add(old_account_id)
    return shared_account_id, pruned_nodes


def _plan_subring_links(n, rng, max_links_per_subring=3):
    """Builds a connected, sparse link plan over n sub-rings (by index): a
    random spanning tree (every sub-ring reachable from every other -
    guarantees one connected structure per case, not isolated islands)
    plus a handful of extra edges so a few sub-rings get 2-3 connections
    instead of a bare tree everywhere. Degree is capped at
    max_links_per_subring per sub-ring in this PLAN graph (a different,
    smaller-scale cap than the account-level MAX_DEGREE_FRACTION check -
    this just keeps any one sub-ring from being asked to donate/receive
    more shared accounts than it plausibly has). Returns a list of
    (i, j) index pairs, i < j, no duplicates.

    Deliberately not fully-connected (every pair linked) - that would
    recreate the single-mega-hub risk this whole module exists to avoid.
    """
    if n < 2:
        return []
    order = list(range(n))
    rng.shuffle(order)
    degree = Counter()
    edges = []
    edge_set = set()

    def add_edge(i, j):
        pair = (min(i, j), max(i, j))
        if pair in edge_set:
            return False
        edges.append(pair)
        edge_set.add(pair)
        degree[i] += 1
        degree[j] += 1
        return True

    # Random spanning tree: each node (after the first, in shuffled order)
    # connects to a random already-placed node - guarantees connectivity.
    for k in range(1, n):
        node = order[k]
        earlier = order[:k]
        # prefer an earlier node still under the degree cap, but fall back
        # to any earlier node if all are already at cap (rare at n<=8)
        under_cap = [e for e in earlier if degree[e] < max_links_per_subring]
        partner = rng.choice(under_cap) if under_cap else rng.choice(earlier)
        add_edge(node, partner)

    # A handful of extra edges for richer (non-tree) structure, respecting
    # the per-subring cap; bounded attempt budget, not a hard requirement.
    extra_target = max(1, n // 2)
    attempts = 0
    added_extra = 0
    while added_extra < extra_target and attempts < n * 6:
        attempts += 1
        i, j = rng.sample(range(n), 2)
        if degree[i] >= max_links_per_subring or degree[j] >= max_links_per_subring:
            continue
        if add_edge(i, j):
            added_extra += 1

    return edges


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
    """Builds one showcase case: 2+ sub-rings (adaptive to the 80-250 node
    target and escape-hatch-adjusted for the degree cap), a dense-but-
    sparse web of shared-account links connecting every sub-ring into one
    structure, and a final cap check (with retries) on the fully-composed
    result.

    Returns (case_result, subring_summaries, subring_links,
    unrealized_pairs, (max_deg, ratio, hub_node)) where case_result is the
    usual {"nodes","edges","case_metadata"} shape, subring_summaries is a
    list of per-subring bookkeeping dicts (for reporting - not persisted),
    subring_links is a list of {subring_a_id, subring_b_id,
    shared_account_id} records for subring_ground_truth.json, and
    unrealized_pairs lists planned links that couldn't be realized because
    one side ran out of distinct mule accounts to give.
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
    # Every shared-account link removes ~2-3 nodes (the pruned duplicate
    # identity) from whichever sub-ring is on the receiving end. With dense
    # linking (every sub-ring connected, not just one pair) there are
    # roughly as many links as sub-rings, so the buffer has to scale with
    # sub-ring count, not be a flat +3 like the single-link design - a
    # generous fixed margin covers the realistic 4-8 sub-ring range here.
    min_size_before_merge = min_size + 24

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

    # Dense-but-sparse linking: every sub-ring connects to at least one
    # other (a random spanning tree guarantees one connected structure for
    # the whole case, not isolated islands), with a few sub-rings getting
    # 2-3 connections - not full pairwise linking, which would recreate a
    # mega-hub risk. Each planned (i, j) pair attempts a real
    # shared-account merge; a pair is skipped (not force-retried
    # elsewhere) if one side has run out of distinct mule accounts to
    # give - reported via which planned links didn't materialize.
    #
    # Degree cap is re-checked on the fully-linked result, not assumed to
    # hold just because the single-link design was fine: denser linking
    # concentrates more redirected edges onto whichever accounts get
    # picked as "A" donors. Every realized link is also checked for a
    # coincidental PERSON-name collision between the two sub-rings (two
    # independently-generated rings can, by chance, draw the same name from
    # the shared pool - a real surface-level tell, unrelated to the
    # deliberate shared-account link, that would give the connection away
    # for the wrong reason). Both checks retry the LINK PLAN (fresh deep
    # copies of the pre-merge sub-rings, a new random plan), scoring each
    # attempt by (name_collisions, degree_cap_violated, ratio) and keeping
    # the best.
    subring_person_names = [
        {n["canonical_name"] for n in result["nodes"] if n["type"] == "PERSON"}
        for result, _, _ in subrings
    ]

    best_attempt = None
    best_score = None
    for _attempt in range(6):
        subrings_copy = copy.deepcopy(subrings)
        used_accounts = [set() for _ in subrings_copy]
        subring_links = []
        planned_pairs = _plan_subring_links(len(subrings_copy), case_selection_rng)
        unrealized_pairs = []
        name_collisions = 0
        for i, j in planned_pairs:
            subring_a_result = subrings_copy[i][0]
            subring_b_result = subrings_copy[j][0]
            shared_account_id, pruned_b_nodes = _merge_shared_account(
                subring_a_result, subring_b_result, used_accounts[i], used_accounts[j], case_selection_rng)
            if shared_account_id is not None:
                subring_b_result["nodes"] = pruned_b_nodes
                subring_links.append({
                    "subring_a_id": subring_a_result["case_metadata"]["case_id"],
                    "subring_b_id": subring_b_result["case_metadata"]["case_id"],
                    "shared_account_id": shared_account_id,
                })
                if subring_person_names[i] & subring_person_names[j]:
                    name_collisions += 1
            else:
                unrealized_pairs.append((subrings_copy[i][0]["case_metadata"]["case_id"],
                                          subrings_copy[j][0]["case_metadata"]["case_id"]))

        all_nodes, all_edges = [], []
        subring_summaries = []
        for result, motif, subtype in subrings_copy:
            all_nodes.extend(result["nodes"])
            all_edges.extend(result["edges"])
            subring_summaries.append({
                "subring_id": result["case_metadata"]["case_id"],
                "motif": motif,
                "scam_subtype": subtype,
                "node_count": len(result["nodes"]),
            })

        max_deg, ratio, hub_node = _max_degree_ratio(all_nodes, all_edges)
        cap_violated = ratio > MAX_DEGREE_FRACTION
        score = (name_collisions, cap_violated, ratio)
        attempt_result = (all_nodes, all_edges, subring_summaries, subring_links,
                           unrealized_pairs, max_deg, ratio, hub_node)
        if best_score is None or score < best_score:
            best_score = score
            best_attempt = attempt_result
        if name_collisions == 0 and not cap_violated:
            break

    all_nodes, all_edges, subring_summaries, subring_links, unrealized_pairs, max_deg, ratio, hub_node = best_attempt

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
    return case_result, subring_summaries, subring_links, unrealized_pairs, (max_deg, ratio, hub_node)


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
        case_result, subring_summaries, subring_links, unrealized_pairs, (max_deg, ratio, hub_node) = compose_showcase_case(
            case_id, case_selection_rng, entity_attribute_rng, created_at)
        case_results.append(case_result)
        for link in subring_links:
            subring_ground_truth.append({"case_id": case_id, **link})
        report_rows.append((case_id, subring_summaries, subring_links, unrealized_pairs, max_deg, ratio, hub_node))

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
