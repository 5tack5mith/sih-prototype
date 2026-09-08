"""
Builds one FIR/complaint document (schema spec Section 7) for a given case,
using only values that trace back to that case's actual generated entities
and transactions - never an invented name, amount, or account.

Depends on Phase C's output/graph_nodes.json, graph_edges.json, and
case_metadata.json (see build_case_indices), and on the templates in
text_templates.py.
"""

import re

from text_templates import (
    AUTHORITY_DISPLAY_VARIANTS,
    DIGITAL_ARREST_AUTHORITIES,
    DIGITAL_ARREST_TEMPLATES,
    SIMPLE_SUBTYPE_TEMPLATES,
    SLOT_LABELS,
)

_SLOT_RE = re.compile(r"\{(\w+)\}")


def format_inr(amount):
    """Formats a rupee amount using Indian digit grouping, e.g.
    1234567.5 -> '12,34,567.50'."""
    amount = round(float(amount), 2)
    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    digits = str(rupees)
    if len(digits) <= 3:
        grouped = digits
    else:
        last3 = digits[-3:]
        rest = digits[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        grouped = ",".join(groups) + "," + last3
    return f"{grouped}.{paise:02d}"


def _format_amount_lakh(amount):
    """'X.XX lakh' phrasing for amounts >= 1 lakh, e.g. 596866.31 -> '5.97 lakh'."""
    return f"{amount / 100_000:.2f} lakh"


def choose_amount_format(amount, rng):
    """Picks one amount-rendering style for this document (Indian
    comma-grouped with paise, comma-grouped rupees only, plain digits, or
    'X lakh' phrasing for large amounts) - purely how the same real amount
    is displayed, never a different value. Chosen once per document so a
    single FIR reads consistently, the way a real complainant would write
    the same way throughout their own statement."""
    styles = [
        lambda a: format_inr(a),
        lambda a: format_inr(a).split(".")[0],
        lambda a: str(int(round(a))),
    ]
    if amount >= 100_000:
        styles.append(_format_amount_lakh)
    return rng.choice(styles)(amount)


def choose_phone_format(phone_number, rng):
    """Picks one phone-rendering style for this document (raw 10 digits, or
    '+91 XXXXX XXXXX' spaced) - same real number, different display, chosen
    once per document for internal consistency."""
    if rng.random() < 0.5:
        return phone_number
    return f"+91 {phone_number[:5]} {phone_number[5:]}"


def _usable(fragment, values):
    """True if every {slot} placeholder in fragment has a value available in
    `values` - filters out fragments needing data this case doesn't have
    (e.g. a `{phone}` fragment, when the victim has no PHONE entity)."""
    return all(slot in values for slot in _SLOT_RE.findall(fragment))


def render_template(template, values):
    """Renders one `{slot}`-style template against `values`, building the
    output string and recording each inserted value's exact character span
    as it is appended - never searching for it afterwards, which would give
    the wrong span for any value that happens to repeat elsewhere in the
    text. Returns (text, spans) where spans is a list of
    {"text", "label", "start", "end"} dicts with offsets relative to the
    start of this rendered text."""
    pieces = []
    spans = []
    cursor = 0
    pos = 0
    for match in _SLOT_RE.finditer(template):
        literal = template[pos:match.start()]
        pieces.append(literal)
        cursor += len(literal)

        slot = match.group(1)
        value = str(values[slot])
        start = cursor
        pieces.append(value)
        cursor += len(value)
        spans.append({"text": value, "label": SLOT_LABELS[slot], "start": start, "end": cursor})

        pos = match.end()
    pieces.append(template[pos:])
    return "".join(pieces), spans


def _compose_stage(fragment_groups, values, rng, cursor):
    """Picks one usable fragment from each group (in order), renders each
    against `values`, and joins them with a single space into one stage's
    text - each fragment is an independently-complete sentence, so any
    combination reads coherently. Returns (stage_text, spans_with_offsets)
    where span offsets are relative to `cursor` (the running position in
    the document being built), not to this stage alone."""
    stage_pieces = []
    stage_spans = []
    stage_cursor = 0
    for i, group in enumerate(fragment_groups):
        candidates = [f for f in group if _usable(f, values)]
        fragment = rng.choice(candidates)
        text, spans = render_template(fragment, values)

        if i > 0:
            stage_pieces.append(" ")
            stage_cursor += 1

        for span in spans:
            stage_spans.append({
                "text": span["text"], "label": span["label"],
                "start": span["start"] + stage_cursor + cursor,
                "end": span["end"] + stage_cursor + cursor,
            })

        stage_pieces.append(text)
        stage_cursor += len(text)

    return "".join(stage_pieces), stage_spans


def build_case_indices(nodes, edges, case_metadata):
    """Slices the merged Phase C nodes/edges lists back into a per-case view.

    Neither `nodes` nor `edges` carry an explicit case_id field, but
    assemble.py's generation loop appends each case's nodes and edges as one
    contiguous block, in the same order as case_metadata, before the noise
    graph (and any cross-case bridge edges) is appended at the very end.
    That means positional slicing by each case_metadata entry's
    `node_count` recovers exact case membership with no change to the
    generator - verified against `total_amount_inr` (summing each case's
    own TRANSACTION edges reproduces that field exactly).

    Returns {case_id: {"meta", "victims", "account_by_person",
    "phone_by_person", "transactions"}}.
    """
    index = {}
    cursor = 0
    for meta in case_metadata:
        n = meta["node_count"]
        case_nodes = nodes[cursor:cursor + n]
        cursor += n

        node_ids = {node["id"] for node in case_nodes}
        case_edges = [e for e in edges if e["source_id"] in node_ids and e["target_id"] in node_ids]

        victims = [n for n in case_nodes if n["type"] == "PERSON" and n["ground_truth"]["role"] == "victim"]
        account_by_person = {n["linked_person_id"]: n for n in case_nodes if n["type"] == "ACCOUNT"}
        phone_by_person = {n["linked_person_id"]: n for n in case_nodes if n["type"] == "PHONE"}
        transactions = [e for e in case_edges if e["type"] == "TRANSACTION"]

        index[meta["case_id"]] = {
            "meta": meta,
            "victims": victims,
            "account_by_person": account_by_person,
            "phone_by_person": phone_by_person,
            "transactions": transactions,
        }
    return index


def _victim_first_outflow(case_entry, victim):
    """Returns (amount, target_account_id) for the earliest TRANSACTION edge
    out of this victim's own account - the real amount and real first-hop
    account this victim's money actually moved to. Returns None if the
    victim has no linked account or no recorded outgoing transaction (should
    not happen for a generated fraud ring, but this is checked rather than
    assumed, since a caller must not invent a value in that case)."""
    account = case_entry["account_by_person"].get(victim["id"])
    if account is None:
        return None
    outflows = [e for e in case_entry["transactions"] if e["source_id"] == account["id"]]
    if not outflows:
        return None
    first = min(outflows, key=lambda e: e["timestamp"])
    return first["amount"], first["target_id"]


def generate_fir(case_id, case_index, doc_seq, rng):
    """Builds one FIR document dict for `case_id`. `doc_seq` (1-based) cycles
    through the case's available victims when there is more than one,
    and `rng` (a random.Random) drives which fragment variants, which
    impersonated-authority phrasing, and which amount/phone display style
    get chosen.

    Returns None if the case has no victim, or its victim(s) have no
    recorded outgoing transaction to build a real amount/account_ref from -
    in either case there is no real data to build a document from, so none
    is fabricated.
    """
    entry = case_index[case_id]
    victims = entry["victims"]
    if not victims:
        return None

    victim = victims[(doc_seq - 1) % len(victims)]
    outflow = _victim_first_outflow(entry, victim)
    if outflow is None:
        return None
    amount, account_ref = outflow

    values = {
        "victim_name": victim["canonical_name"],
        "amount": choose_amount_format(amount, rng),
        "account_ref": account_ref,
        "location": f"{victim['visible']['district']}, {victim['visible']['state']}",
    }
    victim_phone = entry["phone_by_person"].get(victim["id"])
    if victim_phone is not None:
        values["phone"] = choose_phone_format(victim_phone["visible"]["phone_number"], rng)

    subtype = entry["meta"]["scam_subtype"]
    if subtype == "digital_arrest":
        authority = rng.choice(DIGITAL_ARREST_AUTHORITIES)
        values["impersonated_authority"] = rng.choice(AUTHORITY_DISPLAY_VARIANTS[authority])
        stage_order = ["impersonation", "intimidation", "confinement", "extortion"]
        stage_templates = DIGITAL_ARREST_TEMPLATES
    else:
        stage_order = ["lure", "deposit", "lockout"]
        stage_templates = SIMPLE_SUBTYPE_TEMPLATES[subtype]

    narrative_stages = {}
    labeled_entities = []
    text_pieces = []
    cursor = 0
    for i, stage in enumerate(stage_order):
        fragment_groups = stage_templates[stage]
        if i > 0:
            text_pieces.append(" ")
            cursor += 1

        stage_text, stage_spans = _compose_stage(fragment_groups, values, rng, cursor)
        labeled_entities.extend(stage_spans)
        text_pieces.append(stage_text)
        cursor += len(stage_text)
        narrative_stages[stage] = stage_text

    return {
        "doc_id": f"FIR-{case_id}-{doc_seq:02d}",
        "case_id": case_id,
        "scam_subtype": subtype,
        "narrative_stages": narrative_stages,
        "labeled_entities": labeled_entities,
        # Full concatenated narrative (stages joined with a single space, in
        # stage_order) - not part of the Section 7 example, but required for
        # labeled_entities' start/end offsets to mean anything: schema
        # Section 7 shows narrative_stages as separate per-stage strings,
        # and the corpus's self-check explicitly validates spans against
        # "the concatenated document text", so that concatenation has to be
        # stored, not just implied.
        "text": "".join(text_pieces),
    }
