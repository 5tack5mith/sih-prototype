# Zone 1 graph analysis and serving

This package contains independently runnable, case-scoped Neo4j analysis jobs. It
also exposes persisted results through the read-oriented FastAPI application in
`app/api`; only the pairwise path endpoint performs a request-time graph query.

The schema lives only in `schema_config.py`; every query builder imports labels,
relationship types, and property names from there rather than hardcoding them.

## Two graphs in one Neo4j instance

- **Raw graph**: a faithful copy of `dataset_generator/output/` — `Person`,
  `Account`, `Phone`, `RecruiterPlatform`, `CryptoOfframp` nodes; `TRANSACTION`
  (Account->Account), `RECRUITED_VIA` (RecruiterPlatform->Person),
  `SHARED_ADDRESS`/`SHARED_DEVICE` (Person->Person), and `OWNS`
  (Person->Account, Person->Phone, synthesized from `linked_person_id` since
  the source data only has it as an attribute) relationships. `ground_truth`
  is never ingested — `app/ingest_dataset.py` only reads each entity's
  `visible` block. Loaded and case-scoped by `app/ingest_dataset.py`.
- **Analytical graph** (`ENTITY_NODE_LABELS = ("Person",)`, what every
  Zone 1 algorithm and API endpoint actually queries): `Person` nodes
  connected by `TRANSACTED_WITH` (materialized by
  `app/project_person_graph.py`, aggregating raw Account-level `TRANSACTION`
  edges resolved through `OWNS`/`linked_person_id` — one edge per ordered
  person pair, excluding self-transactions and anything terminating at a
  `CryptoOfframp`) plus the already-Person-to-Person `SHARED_ADDRESS`/
  `SHARED_DEVICE` raw edges, used directly with no separate projection step.

Background-noise entities (`is_background_noise: true`) carry no `case_id` and
never enter the analytical graph via `TRANSACTED_WITH`, but a noise person
directly linked to a case's own person by `SHARED_ADDRESS`/`SHARED_DEVICE` is
still surfaced in that case's `get_case_graph` result (one-sided case scoping,
`repository.get_case_graph`) since that link is itself real, in-case evidence.

75 `TRANSACTED_WITH` edges are deliberate cross-case bridges (two different
cases' terminal accounts, reused from `dataset_generator`'s bridge injection)
and carry no `case_id` at all — every case-scoped query already requires both
endpoints to resolve to the same requested case, so these are excluded from
every single-case view by construction, not by special-casing.

## Workflow

```bash
docker compose up -d neo4j
docker compose --profile dataset run --rm ingest-dataset
docker compose --profile dataset run --rm project-person-graph
docker compose --profile analysis run --rm validate-scoping
docker compose --profile analysis run --rm project-graphs
docker compose --profile analysis run --rm core-algorithms
docker compose --profile analysis run --rm structural-roles
docker compose --profile analysis run --rm criticality
docker compose --profile analysis run --rm financial-patterns
docker compose up -d api
# OpenAPI: http://localhost:8000/docs
```

`ingest-dataset` replaces whatever is currently in Neo4j (including the
disposable `placeholder-data` toy graph) rather than merging with it — run at
most one of `placeholder-data` or `ingest-dataset`, never both in sequence
without expecting the second to wipe the first.

Each analysis command processes every discovered case by default. Most commands
also accept a case ID as their positional argument when run directly:

```bash
NEO4J_URI=bolt://localhost:7687 .venv/bin/python -m app.run_core_algorithms C-0001
```

Always run scoping validation first. A blocking warning means algorithm jobs must
not proceed until missing or unresolved data is deliberately resolved.
`cross_case_relationship_count` is reported but does not block — the 75
cross-case `TRANSACTED_WITH` bridges above are an expected, deliberate count,
not an error.


## API authentication

Set `AUTH_SECRET_KEY` plus the two bootstrap-admin variables in `.env` before starting the API. Log in with `POST /login`, then pass its bearer token on API requests. Admins manage accounts, case assignments, lifecycle, and all case data. Investigators only see active cases assigned to them; access to anything else intentionally returns `404`. Auth SQLite data is persisted in the Compose `auth_data` volume. See `app/api/API.md` for assignment and purge endpoints.


### One-command authentication smoke test

After setting `.env`, run:

```bash
docker compose --profile smoke run --rm smoke-test
```

It starts Neo4j and the API as dependencies, logs in as the bootstrap admin, verifies `/me`, and makes an authenticated `/cases` request.
