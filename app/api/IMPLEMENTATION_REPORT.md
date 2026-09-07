# API layer implementation report

## Delivered

The FastAPI application lives at `app.api.main:app`. It exposes all nine requested endpoint groups through an injectable Neo4j repository and Pydantic response contracts. All labels, relationship types, and Neo4j property names originate in `app/schema_config.py`; request values remain Cypher parameters.

- `/cases` performs database-side filtering and sorting and returns missing metadata as `null`.
- `/cases/{case_id}/overview` reads scoped counts, persisted Louvain modularity, and financial flag counts.
- `/nodes/top` reads persisted betweenness, eigenvector, or degree scores.
- Node inspection returns scores, role, first contact, financial flag count, and a one-hop ego network.
- The case graph returns persisted analysis and precomputed density, diameter, and reciprocity; filters run in Cypher.
- Community endpoints read persisted densities and use generic `Cluster {id}` labels plus deterministic narratives.
- Path Explorer uses scoped `shortestPath` up to 15 hops. `connection_strength` is the mean of `weight / (weight + 1)` across path edges, not confidence.
- Criticality only slices stored ranks. The offline job stores baseline node count and global efficiency before/after each removal.
- Suggested links read Jaccard `SIMILAR_TO` relationships and exclude existing structural links.

## Algorithm and schema additions

The batch layer now writes eigenvector centrality, Louvain modularity, community densities, graph density, diameter, and reciprocity. Criticality defaults to 10 ranks and persists global efficiency per step. Placeholder cases include representative metadata and entity categories; production reads remain nullable.

## Deterministic language safeguards

No endpoint returns confidence, predicts criminality, recommends action, or invents descriptive community names. Community, path, and criticality narratives only restate response values. Link predictions are explicitly suggestions.

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
docker compose up -d api
```

The endpoint inventory and request/response models are in `app/api/API.md`; interactive schemas are available from `/docs`.
