# API layer implementation report

## Delivered

The FastAPI application lives at `app.api.main:app`. It exposes the analysis endpoint groups through an injectable Neo4j repository and Pydantic response contracts. All labels, relationship types, and Neo4j property names originate in `app/schema_config.py`; request values remain Cypher parameters.

- `/cases` performs database-side filtering and sorting and returns missing metadata as `null`.
- `/cases/{case_id}/overview` reads scoped counts, persisted Louvain modularity, and financial flag counts.
- `/nodes/top` reads persisted betweenness, eigenvector, or degree scores.
- Node inspection returns scores, role, first contact, financial flag count, and a one-hop ego network.
- The case graph returns persisted analysis and precomputed density, diameter, and reciprocity; filters run in Cypher.
- Community endpoints read persisted densities and use generic `Cluster {id}` labels plus deterministic narratives.
- Path Explorer uses scoped `shortestPath` up to 15 hops. `connection_strength` is the mean of `weight / (weight + 1)` across path edges, not confidence.
- Criticality only slices stored ranks. The offline job stores baseline node count and global efficiency before/after each removal.
- Suggested links read Jaccard `SIMILAR_TO` relationships and exclude existing structural links.
- Summary endpoints read precomputed case/community prose and never invoke an LLM during a request.

## Authentication and authorization

JWT authentication is mandatory for every case and analysis endpoint. Tokens are verified against the current SQLite user record, so an account's database role is authoritative rather than a stale token claim. `AUTH_SECRET_KEY` has no fallback. The configured first admin is bootstrapped idempotently from the paired bootstrap environment variables.

Assignments are SQLite-backed many-to-many records. Admins can list, assign, and unassign investigators; investigators can list and open only their assigned active cases. Inaccessible or completed cases return `404` to investigators. Admin lifecycle routes mark cases important, mark them completed, restore them, and permanently purge completed cases only, dropping case GDS projections and case-scoped Neo4j data while preserving unrelated/background data. Compose persists SQLite data in the `auth_data` volume.

## Algorithm and schema additions

The batch layer now writes eigenvector centrality, Louvain modularity, community densities, graph density, diameter, and reciprocity. Criticality defaults to 10 ranks and persists global efficiency per step. Placeholder cases include representative metadata and entity categories; production reads remain nullable.

## Zone 2 summary safeguards

The summary batch constructs a fixed JSON object solely from persisted counts, centrality scores, structural roles, Louvain aggregates, criticality ranks, and financial flags. It never supplies raw graph nodes/edges, tools, function calling, retrieval, or graph access to the LLM. The exact constrained system prompt prohibits speculation and directives. Calls use OpenRouter model `nex-agi/nex-n2.5-mini:free` with a 10-second timeout; every failure stores a deterministic fallback and records `summary_source` as `template`. Successful output records `llm`. Case summaries live on `Case`; community summaries are case-owned derived-result nodes and are replaced on recomputation.

The three summary endpoints use the same JWT and case-level RBAC dependency as existing analysis routes. They only read persisted text, source, and timestamp. No endpoint returns confidence, predicts criminality, recommends action, or invents descriptive community names. Existing community, path, and criticality narratives remain deterministic. Link predictions are explicitly suggestions.

## Schema-pending fields

Case status, priority, description, updated time, lead analyst, jurisdiction, entity type, and first-contact date are provisional constants. When the real dataset arrives, map them in `schema_config.py` and ingestion mappings rather than adding literals to API queries.

## Validation

```bash
.venv/bin/python -m pytest -q
docker compose config --quiet
docker compose up -d neo4j
docker compose --profile placeholder run --rm placeholder-data
docker compose --profile analysis run --rm core-algorithms
docker compose --profile analysis run --rm criticality
docker compose --profile analysis run --rm financial-patterns
docker compose --profile analysis run --rm summary-generation
docker compose up -d api
```

The endpoint inventory and request/response models are in `app/api/API.md`; interactive schemas are available from `/docs`.
