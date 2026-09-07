# Zone 1 + Zone 2 API contracts

| Endpoint | Description | Request | Response model |
|---|---|---|---|
| `GET /cases` | Lists case metadata and scoped graph counts. | Query: `filter=active|archived|flagged`, `sort=last_activity|name` | `CaseSummary[]` |
| `GET /cases/{case_id}/overview` | Returns persisted modularity and scoped graph/financial-flag counts. | Path: `case_id` | `CaseOverview` |
| `GET /cases/{case_id}/nodes/top` | Ranks nodes by a persisted centrality score. | Query: `metric=betweenness|eigenvector|degree`, `limit=1..100` | `TopNodesResponse` |
| `GET /cases/{case_id}/nodes/{node_id}` | Returns persisted scores, structural flags, and a one-hop ego graph. | Path: `case_id`, `node_id` | `NodeDetail` |
| `GET /cases/{case_id}/graph` | Returns the scoped structural graph and precomputed graph metrics. | Query: `filter=bridging_only`, `cutoff>=0` | `CaseGraph` |
