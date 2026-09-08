"""
Phase D driver: builds the FIR/NER training corpus from the freshly
regenerated Phase C output (output/graph_nodes.json, graph_edges.json,
case_metadata.json), self-checks every labeled entity span against its
document's text, splits into train/dev/test by case, and writes JSONL files
to output/.
"""

import argparse
import json
import os
import random
from collections import Counter

from config import HOLDOUT_DISTRICTS
from fir_generator import build_case_indices, generate_fir
from rng_streams import derive_seed

OUTPUT_DIR = "output"

# ASSUMPTION: 6 documents/case x 150 cases lands in the ~900-document range
# suitable for a spaCy NER fine-tune; override with --docs-per-case.
DEFAULT_DOCS_PER_CASE = 6
DEFAULT_SEED = 42

TRAIN_FRACTION = 0.8
DEV_FRACTION = 0.1


def parse_args():
    """Parses CLI args: --docs-per-case and --seed."""
    parser = argparse.ArgumentParser(
        description="Generate the FIR/NER training corpus from Phase C output (Phase D).")
    parser.add_argument("--docs-per-case", type=int, default=DEFAULT_DOCS_PER_CASE,
                         help=f"FIR documents to generate per case (default: {DEFAULT_DOCS_PER_CASE})")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED,
                         help=f"Random seed for template/authority selection (default: {DEFAULT_SEED})")
    return parser.parse_args()


def load_phase_c_output():
    """Loads graph_nodes.json, graph_edges.json, and case_metadata.json from
    OUTPUT_DIR - the Phase C generator's (assemble.py) output."""
    with open(os.path.join(OUTPUT_DIR, "graph_nodes.json"), encoding="utf-8") as f:
        nodes = json.load(f)
    with open(os.path.join(OUTPUT_DIR, "graph_edges.json"), encoding="utf-8") as f:
        edges = json.load(f)
    with open(os.path.join(OUTPUT_DIR, "case_metadata.json"), encoding="utf-8") as f:
        case_metadata = json.load(f)
    return nodes, edges, case_metadata


def self_check(docs):
    """Verifies every labeled_entities span against its own document's text:
    text[start:end] must exactly match the recorded 'text' field, character
    for character. Returns (all_passed, failing_doc_ids)."""
    failing = []
    for doc in docs:
        text = doc["text"]
        for span in doc["labeled_entities"]:
            if text[span["start"]:span["end"]] != span["text"]:
                failing.append(doc["doc_id"])
                break
    return len(failing) == 0, failing


def _case_uses_holdout_district(case_index, case_id):
    """True if any victim in this case lives in a HOLDOUT_DISTRICTS value -
    such a case must never land in train (see split_by_case)."""
    victims = case_index[case_id]["victims"]
    return any(v["visible"]["district"] in HOLDOUT_DISTRICTS for v in victims)


def split_by_case(docs, case_index, rng):
    """Splits docs into train/dev/test (~80/10/10) by case_id, not by
    document, so that no case's documents leak across splits.

    Additionally: any case using a HOLDOUT_DISTRICTS value is forced into
    dev or test, never train - otherwise a dev/test split would just be
    unseen combinations of an already-fully-observed value set, which
    measures nothing about generalization on the LOCATION label. This is
    the actual generalization test, not optional: train's share drops
    slightly below the target 80% to accommodate whatever fraction of
    cases happen to use a held-out district."""
    all_case_ids = sorted({d["case_id"] for d in docs})
    holdout_cases = [c for c in all_case_ids if _case_uses_holdout_district(case_index, c)]
    normal_cases = [c for c in all_case_ids if c not in holdout_cases]

    rng.shuffle(normal_cases)
    rng.shuffle(holdout_cases)

    n = len(all_case_ids)
    n_train = int(n * TRAIN_FRACTION)
    n_dev = int(n * DEV_FRACTION)

    train_cases = set(normal_cases[:n_train])
    remaining_pool = normal_cases[n_train:] + holdout_cases
    rng.shuffle(remaining_pool)
    dev_cases = set(remaining_pool[:n_dev])
    # everything else (including any remainder from integer rounding) is test

    train, dev, test = [], [], []
    for doc in docs:
        if doc["case_id"] in train_cases:
            train.append(doc)
        elif doc["case_id"] in dev_cases:
            dev.append(doc)
        else:
            test.append(doc)
    return train, dev, test


def write_jsonl(path, docs):
    """Writes docs to path, one JSON object per line (JSONL)."""
    with open(path, "w", encoding="utf-8") as f:
        for doc in docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")


def main():
    """CLI entry point: builds the corpus, writes it and its splits to
    OUTPUT_DIR, prints the summary report, and exits with status 1 if the
    span self-check fails for any document."""
    args = parse_args()
    # Independent from every graph-generation stream (case_selection_rng,
    # entity_attribute_rng, noise_rng in assemble.py) - derived from the
    # same master --seed, but changing a FIR template never reshuffles the
    # graph, and regenerating the graph never reshuffles which template
    # variant gets picked for a given document.
    fir_text_rng = random.Random(derive_seed(args.seed, "fir_text"))

    nodes, edges, case_metadata = load_phase_c_output()
    case_index = build_case_indices(nodes, edges, case_metadata)

    docs = []
    skipped_cases = []
    for meta in case_metadata:
        case_id = meta["case_id"]
        produced_any = False
        for doc_seq in range(1, args.docs_per_case + 1):
            doc = generate_fir(case_id, case_index, doc_seq, fir_text_rng)
            if doc is not None:
                docs.append(doc)
                produced_any = True
        if not produced_any:
            skipped_cases.append(case_id)

    passed, failing_ids = self_check(docs)
    train, dev, test = split_by_case(docs, case_index, fir_text_rng)

    write_jsonl(os.path.join(OUTPUT_DIR, "fir_corpus_full.jsonl"), docs)
    write_jsonl(os.path.join(OUTPUT_DIR, "fir_corpus_train.jsonl"), train)
    write_jsonl(os.path.join(OUTPUT_DIR, "fir_corpus_dev.jsonl"), dev)
    write_jsonl(os.path.join(OUTPUT_DIR, "fir_corpus_test.jsonl"), test)

    print("=" * 60)
    print("FIR CORPUS SUMMARY")
    print("=" * 60)
    print(f"Seed: {args.seed}")
    print(f"Total documents: {len(docs)}")
    if skipped_cases:
        print(f"Cases with no usable victim/outflow (skipped): {len(skipped_cases)} -> {skipped_cases}")

    print("\nDocuments by scam_subtype:")
    for subtype, count in Counter(d["scam_subtype"] for d in docs).items():
        print(f"  {subtype}: {count}")

    label_counts = Counter()
    for doc in docs:
        for span in doc["labeled_entities"]:
            label_counts[span["label"]] += 1
    print("\nLabeled entities by label type:")
    for label, count in label_counts.items():
        print(f"  {label}: {count}")

    print(f"\nSplit sizes: train={len(train)}  dev={len(dev)}  test={len(test)}")

    def holdout_hits(split_docs):
        hits = set()
        for doc in split_docs:
            for span in doc["labeled_entities"]:
                if span["label"] == "LOCATION":
                    for d in HOLDOUT_DISTRICTS:
                        if span["text"].startswith(d):
                            hits.add(d)
        return hits

    train_holdout = holdout_hits(train)
    dev_test_holdout = holdout_hits(dev) | holdout_hits(test)
    print(f"\nHeld-out districts in train (must be empty): {sorted(train_holdout)}")
    print(f"Held-out districts in dev/test: {sorted(dev_test_holdout)}")

    print(f"\nSpan self-check: {'PASS' if passed else 'FAIL'} "
          f"({len(docs) - len(failing_ids)}/{len(docs)} documents clean)")
    if not passed:
        print(f"  Failing doc_ids: {failing_ids}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
