# Mule-Network Synthetic Fraud Dataset — Generator & FIR/NER Corpus

Status: **Phases B, C, and D are done.** This generates a synthetic mule-account
fraud-ring graph (Phase C) and a labeled FIR/NER training corpus built from it
(Phase D). Phase A (schema) is `mule-network-dataset-schema-spec.md` — read
that first if you need to know what a field means; this file is about running
things and using the output, not re-explaining the schema.

## What exists and what it does

| File | What it is |
|---|---|
| `config.py` | Every tunable parameter (ring sizes, amount ranges, timing windows, noise probabilities), each tagged SOURCED/ASSUMPTION so you know what's anchored to real reporting vs. a design choice |
| `entities.py` | Factory functions for the 5 entity types: `make_person`, `make_account`, `make_phone`, `make_recruiter_platform`, `make_crypto_exit` |
| `motifs.py` | The 4 ring topologies from schema Sec. 4: `fast_pass_through`, `fan_out_fan_in`, `dormant_then_burst`, `recruited_crypto_exit` |
| `noise.py` | Background "legitimate" traffic (Barabási–Albert social graph) + a few deliberate cross-links into the fraud rings, so community detection has real noise to filter against |
| `assemble.py` | **Phase C driver.** Generates N cases + noise, writes the combined graph to `output/` |
| `rng_streams.py` | `derive_seed()` — see [Reproducibility](#reproducibility--rng-streams) below |
| `text_templates.py` | FIR narrative templates (4-stage digital_arrest; 3-stage lure/deposit/lockout for the other 3 subtypes), with `{slot}` placeholders |
| `fir_generator.py` | Builds one FIR document for a given case, pulling only real values from that case's actual entities/transactions |
| `generate_fir_corpus.py` | **Phase D driver.** Reads Phase C's `output/`, generates multiple FIR docs per case, self-checks every label span, splits train/dev/test by case |

## Quickstart

```bash
cd dataset_generator
pip install -r ../requirements.txt   # networkx is the only real dependency here

# Phase C: generate the graph
python assemble.py 150 --seed 42

# Phase D: generate the labeled FIR corpus from that graph
python generate_fir_corpus.py --docs-per-case 6 --seed 42
```

That's the whole pipeline. `assemble.py`'s positional arg is case count
(default 40); `generate_fir_corpus.py` reads whatever is currently in
`output/` — **always run `assemble.py` first** if you want the corpus to
reflect a fresh graph.

Everything in `output/` is regenerated output, not source — safe to delete
and rebuild any time.

## Output files

All in `dataset_generator/output/`:

- `graph_nodes.json`, `graph_edges.json` — the full merged entity/relationship graph across every case, plus the noise layer
- `case_metadata.json` — one entry per case (`case_id`, `scam_subtype`, `motif`, `ring_size_tier`, `node_count`, `total_amount_inr`, ...)
- `fir_corpus_full.jsonl` / `fir_corpus_train.jsonl` / `fir_corpus_dev.jsonl` / `fir_corpus_test.jsonl` — the labeled FIR documents (80/10/10 split **by case**, so no case's documents cross a split boundary)

### FIR corpus document shape

One JSON object per line:

```json
{
  "doc_id": "FIR-C-0001-01",
  "case_id": "C-0001",
  "scam_subtype": "digital_arrest",
  "narrative_stages": { "impersonation": "...", "intimidation": "...", "confinement": "...", "extortion": "..." },
  "labeled_entities": [
    {"text": "Sunita Patel", "label": "PERSON", "start": 16, "end": 28},
    {"text": "9847162530", "label": "PHONE", "start": 169, "end": 179}
  ],
  "text": "The complainant Sunita Patel received a video call from ..."
}
```

`text` is the full narrative (all stages concatenated with a single space,
in stage order) — **this, not `narrative_stages`, is what the offsets in
`labeled_entities` index into.** Labels: `PERSON`, `ACCOUNT`, `AMOUNT`,
`PHONE`, `LOCATION`, `ORG`.

Every span was verified against `text[start:end]` at generation time
(`generate_fir_corpus.py`'s self-check, printed in its summary — should
always read `PASS (N/N documents clean)`). If you ever see anything other
than that, something's wrong upstream — don't train on it.

## Using the corpus to fine-tune an NER model

The format (text + character-offset spans) is the standard shape most NER
tooling expects as input, but neither of the two common conversions is done
for you yet — this repo intentionally stops at JSONL:

**spaCy** (`DocBin` / `.spacy` binary format):

```python
import json
import spacy
from spacy.tokens import DocBin

nlp = spacy.blank("en")

def build_docbin(jsonl_path, out_path):
    db = DocBin()
    for line in open(jsonl_path, encoding="utf-8"):
        rec = json.loads(line)
        doc = nlp.make_doc(rec["text"])
        ents = []
        for span in rec["labeled_entities"]:
            ent = doc.char_span(span["start"], span["end"], label=span["label"])
            if ent is not None:  # None if the offsets don't land on token boundaries
                ents.append(ent)
        doc.ents = ents
        db.add(doc)
    db.to_disk(out_path)

build_docbin("output/fir_corpus_train.jsonl", "output/train.spacy")
build_docbin("output/fir_corpus_dev.jsonl", "output/dev.spacy")
```

Then `python -m spacy train config.cfg --paths.train output/train.spacy --paths.dev output/dev.spacy`
(you'll need a spaCy training config — `python -m spacy init config` gives
you a starting point for NER). `spacy` isn't currently in `requirements.txt`;
add it (`pip install spacy`) if you go this route.

**HuggingFace token-classification** (BIO-tagged tokens): needs the char
spans converted to per-token BIO labels after tokenization — the exact code
depends on which tokenizer/model you pick (e.g. `bert-base` WordPiece vs. a
simple whitespace split), so there isn't one canonical snippet. The pattern
is: tokenize `text`, then for each token check which (if any) labeled span
it falls inside, and emit `B-<LABEL>` for the first token of a span,
`I-<LABEL>` for the rest, `O` otherwise.

## Regenerating with different sizes

```bash
python assemble.py 500 --seed 42                          # bigger graph
python generate_fir_corpus.py --docs-per-case 10 --seed 42  # more FIRs/case
```

Changing `--n-cases` regenerates the **whole** dataset differently (not
additive) — case count, motif mix, and every entity shift together, because
of how the seeded random draws chain. Don't expect case `C-0001` from a
150-case run to match `C-0001` from a 500-case run.

## Reproducibility & RNG streams

`--seed` is the only knob you set. Internally, `rng_streams.derive_seed()`
splits it into 4 independent `random.Random()` streams so unrelated changes
can't reshuffle each other's output:

- `case_selection_rng` — motif/subtype/tier picks, and everything else that
  shapes a case's structure (branch counts, timing, amounts, channels)
- `entity_attribute_rng` — passed into every `entities.py` factory call
  (names, occupations, phone digits, KYC status, ...)
- `noise_rng` — the background graph and cross-links, entirely separate
- `fir_text_rng` — FIR template selection, entirely separate from all three
  graph streams

Practical upshot: editing `text_templates.py` and re-running
`generate_fir_corpus.py` **never** changes `graph_nodes.json` /
`graph_edges.json` / `case_metadata.json` — verified directly, not assumed
(see the isolation-test note in git log if you want the proof). Two runs
with the same `--seed` and `--n-cases` are byte-identical.

## Important: `ground_truth` is NOT stripped from `graph_nodes.json`

Unlike a "clean observable evidence vs. hidden answer key" split, every
entity in `graph_nodes.json` carries its `ground_truth` block (role,
mule_type, economic_profile_deviation_score, mule_layer, is_exit_node)
**inline**, right next to `visible`:

```json
{
  "id": "P-00001", "type": "PERSON", "canonical_name": "Neha Chauhan",
  "visible": {"stated_occupation": "business_owner", "state": "Madhya Pradesh", ...},
  "ground_truth": {"role": "victim", "mule_type": null, ...}
}
```

**If you're feeding this graph into anything meant to *discover* the
network** (centrality, community detection, an entity-resolution or
role-classification model) — strip every node's `ground_truth` key first.
Otherwise you're handing the model the answer key, and any evaluation
against it is meaningless. `ground_truth` is exactly and only what you score
predictions against, never an input.

The FIR corpus doesn't have this problem — `labeled_entities` is the
intended supervision signal for NER training, that's what it's for.

## Known limitations

- `account_ref` in FIR text is the account's internal entity ID (e.g.
  `A-00002`), not a real-looking bank account number — same for `phone`
  before the phone_number field existed. Phone numbers *are* now real-format
  10-digit strings; account numbers are not.
- FIRs are plain narrative strings, not rendered as any document format.
- `assemble.py`'s sanity checks are structural only (mule_layer set on every
  mule account, node counts match, no duplicate IDs) — there's no
  content-level validation pass (cross-checking amounts across every
  transaction hop, NER span accuracy at scale, etc.) the way a more mature
  generator might have. The FIR corpus's own span self-check is the one
  content-level guarantee that's actually enforced.
- No D4/D5-equivalent motifs (bridges between rings, multi-ring spread) —
  every case here is one self-contained ring plus background noise.

## Where to look next

- Field-by-field schema: `mule-network-dataset-schema-spec.md`
- Original build prompt (Phase B/C scope, before the seed/isolation/Phase-D
  work): `CLAUDE_CODE_PROMPT.md`
