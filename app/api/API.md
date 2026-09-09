# Zone 1 + Zone 2 API contracts

| Endpoint | Description | Request | Response model |
|---|---|---|---|
| `GET /cases` | Lists case metadata and scoped graph counts. | Query: `filter=active|archived|flagged`, `sort=last_activity|name` | `CaseSummary[]` |
| `GET /cases/{case_id}/overview` | Returns persisted modularity and scoped graph/financial-flag counts. | Path: `case_id` | `CaseOverview` |
| `GET /cases/{case_id}/nodes/top` | Ranks nodes by a persisted centrality score. | Query: `metric=betweenness|eigenvector|degree`, `limit=1..100` | `TopNodesResponse` |
| `GET /cases/{case_id}/nodes/{node_id}` | Returns persisted scores, structural flags, and a one-hop ego graph. | Path: `case_id`, `node_id` | `NodeDetail` |
| `GET /cases/{case_id}/graph` | Returns the scoped structural graph and precomputed graph metrics. | Query: `filter=bridging_only`, `cutoff>=0` | `CaseGraph` |
| `GET /cases/{case_id}/communities` | Lists Louvain communities with persisted densities and generic labels. | Path: `case_id` | `CommunitySummary[]` |
| `GET /cases/{case_id}/communities/{community_id}` | Returns members, persisted densities, and a deterministic narrative. | Path: `case_id`, `community_id` | `CommunityDetail` |
| `GET /cases/{case_id}/path` | Finds a scoped shortest path; strength is the mean `weight/(weight+1)`, never confidence. | Query: `from_node_id`, `to_node_id` | `PathResponse` |
| `GET /cases/{case_id}/criticality` | Slices precomputed fragmentation ranks and provides a traceable impact template. | Query: `top_k=3|6|10` | `CriticalityResponse` |
| `GET /cases/{case_id}/nodes/{node_id}/suggested_links` | Lists persisted Jaccard candidates that lack a structural edge; suggestions are not facts. | Path: `case_id`, `node_id` | `SuggestedLink[]` |


## Authentication and case access

All endpoints require `Authorization: Bearer <access_token>` except `POST /login`. The first administrator is created at startup from `AUTH_BOOTSTRAP_ADMIN_USERNAME` and `AUTH_BOOTSTRAP_ADMIN_PASSWORD`; both variables must be set together. `AUTH_SECRET_KEY` is required. Administrators can register users, read every case (including archived cases), manage assignments, archive/restore, and purge. Investigators can read only active cases assigned to their own account. A missing, archived, or unassigned case is returned as `404` to investigators.

| Endpoint | Access | Behavior |
|---|---|---|
| `POST /login` | Public | Returns bearer token. |
| `POST /register`, `GET /me` | Admin / authenticated | Create users / view current database-backed account. |
| `GET /cases/{case_id}/assignments` | Admin | List assigned investigators. |
| `PUT /cases/{case_id}/assignments/{username}` | Admin | Idempotently assign an existing investigator to an active case. |
| `DELETE /cases/{case_id}/assignments/{username}` | Admin | Remove an assignment. |
| `POST /cases/{case_id}/archive`, `POST /cases/{case_id}/restore` | Admin | Change lifecycle status; archive retains assignments. |
| `DELETE /cases/{case_id}` | Admin | Permanently purge an archived case only; active cases return `409`. |

Example: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/cases`. SQLite identity and assignment data persists in the Compose `auth_data` volume.
