"""
Cross-case bridges: deliberately reuses a small number of already-existing
accounts across otherwise-independent cases, so the combined graph isn't
150 fully disconnected islands.

Without this, every case is generated in total isolation (its own fresh
Person/Account/Phone entities, never shared with any other case) - which
means there is no hidden link between seemingly unrelated FIRs for
community detection or centrality analysis to find. Real investigations
routinely surface exactly this: the same downstream mule/aggregator account
laundering proceeds for multiple "unrelated" scam operations. This module
adds a small number of such links after all cases are otherwise fully
generated, using only accounts that already exist - no new PERSON/ACCOUNT
nodes are created, so case_metadata.node_count (and therefore Phase D's
positional-slicing contract) is untouched by this module.

Ground truth for which cases got linked is written separately (by the
caller) to output/bridge_ground_truth.json, never embedded in the
observable graph files - same reasoning as why every node's own
`ground_truth` block would ideally be isolated: this is exactly what a
discovery-style analysis pipeline is supposed to find, not be handed.
"""

from datetime import timedelta

from motifs import make_transaction_edge


def _case_terminal_account(case_result):
    """Picks the one account that best represents "where this case's money
    ends up" - the account explicitly marked is_exit_node=True if the motif
    set one (fast_pass_through, fan_out_fan_in, recruited_crypto_exit all
    do), otherwise (dormant_then_burst does not) the account with the
    largest total inbound amount among accounts that never send money
    onward within this case (a computed sink), so every case has some
    valid terminal account regardless of motif."""
    accounts = {n["id"]: n for n in case_result["nodes"] if n["type"] == "ACCOUNT"}
    exit_accounts = [a for a in accounts.values() if a["ground_truth"].get("is_exit_node")]
    if exit_accounts:
        return exit_accounts[0]["id"]

    outgoing = {e["source_id"] for e in case_result["edges"] if e["type"] == "TRANSACTION"}
    inbound_total = {}
    for e in case_result["edges"]:
        if e["type"] != "TRANSACTION":
            continue
        inbound_total[e["target_id"]] = inbound_total.get(e["target_id"], 0) + e["amount"]

    sinks = [aid for aid in accounts if aid not in outgoing and aid in inbound_total]
    return max(sinks, key=lambda aid: inbound_total[aid])


def _latest_transaction_time(case_result, account_id):
    """Latest TRANSACTION timestamp touching account_id within this case's
    own edges - used to place a bridge edge realistically shortly after
    that account's own real activity, rather than at an arbitrary time."""
    times = [
        e["timestamp"] for e in case_result["edges"]
        if e["type"] == "TRANSACTION" and account_id in (e["source_id"], e["target_id"])
    ]
    return max(times)


def inject_cross_case_bridges(case_results, case_selection_rng, n_hubs,
                               min_spokes=3, max_spokes=14,
                               amount_range=(500, 50_000)):
    """Adds cross-case bridge TRANSACTION edges to a small subset of cases.

    case_results: the list of {"nodes", "edges", "case_metadata"} dicts
    already returned by the main per-case generation loop, one per case, in
    order.

    Picks n_hubs cases (case_selection_rng) to act as hubs; for each hub,
    picks a varying number of spoke cases (min_spokes..max_spokes, so
    degree genuinely varies rather than being flat), biased toward larger
    spoke cases (real syndicates concentrate around a handful of
    substantial rings, not a flat random mix - this is also what lets at
    least one merged component actually grow large rather than every
    bridge group topping out around the same modest size), and adds one
    TRANSACTION edge from each spoke's own terminal account into the hub's
    terminal account. Every account (hub or spoke) is used in at most one
    bridge group - this is what caps degree: no account can end up with
    more added bridge edges than its own group's spoke count, and no
    single account can become an implausible mega-hub touching everything.

    Returns (new_edges, bridge_ground_truth) - new_edges is a flat list of
    the added TRANSACTION edges (append to the combined edge list), and
    bridge_ground_truth is a list of {hub_case_id, hub_account_id,
    spoke_case_id, spoke_account_id, edge_amount} records for a separate,
    hidden output file.
    """
    if len(case_results) < 3 or n_hubs <= 0:
        return [], []

    case_ids = [r["case_metadata"]["case_id"] for r in case_results]
    result_by_case_id = dict(zip(case_ids, case_results))
    account_count_by_case = {
        cid: sum(1 for n in result_by_case_id[cid]["nodes"] if n["type"] == "ACCOUNT")
        for cid in case_ids
    }

    # Process the largest cases first as hub candidates, so the first
    # (biggest) hub groups get first pick of the largest remaining spokes -
    # this is what produces one genuinely large merged component rather
    # than n_hubs equally-modest ones.
    available = sorted(case_ids, key=lambda cid: account_count_by_case[cid], reverse=True)

    new_edges = []
    bridge_ground_truth = []
    used_case_ids = set()

    hubs_made = 0
    idx = 0
    while hubs_made < n_hubs and idx < len(available):
        hub_case_id = available[idx]
        idx += 1
        if hub_case_id in used_case_ids:
            continue

        n_spokes = case_selection_rng.randint(min_spokes, max_spokes)
        spoke_pool = [cid for cid in available[idx:] if cid not in used_case_ids]
        if len(spoke_pool) < 2:
            break
        # Bias toward larger cases: sample from the largest 2x candidates
        # (still randomized which of those get picked, and how many).
        spoke_pool_sorted = sorted(spoke_pool, key=lambda cid: account_count_by_case[cid], reverse=True)
        biased_pool = spoke_pool_sorted[:min(n_spokes * 2, len(spoke_pool_sorted))]
        spoke_case_ids = case_selection_rng.sample(biased_pool, min(n_spokes, len(biased_pool)))

        hub_result = result_by_case_id[hub_case_id]
        hub_account_id = _case_terminal_account(hub_result)

        used_case_ids.add(hub_case_id)
        for spoke_case_id in spoke_case_ids:
            available.remove(spoke_case_id)
            used_case_ids.add(spoke_case_id)

            spoke_result = result_by_case_id[spoke_case_id]
            spoke_account_id = _case_terminal_account(spoke_result)

            spoke_last_time = _latest_transaction_time(spoke_result, spoke_account_id)
            from datetime import datetime
            bridge_time = datetime.fromisoformat(spoke_last_time) + timedelta(
                hours=case_selection_rng.uniform(1, 48))

            amount = case_selection_rng.uniform(*amount_range)
            channel = case_selection_rng.choice(["upi", "neft_imps", "atm_withdrawal"])

            edge = make_transaction_edge(spoke_account_id, hub_account_id, amount,
                                          bridge_time, channel, case_selection_rng)
            new_edges.append(edge)
            bridge_ground_truth.append({
                "hub_case_id": hub_case_id,
                "hub_account_id": hub_account_id,
                "spoke_case_id": spoke_case_id,
                "spoke_account_id": spoke_account_id,
                "edge_amount": edge["amount"],
            })

        hubs_made += 1

    return new_edges, bridge_ground_truth
