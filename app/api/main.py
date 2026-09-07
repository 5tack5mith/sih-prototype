from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query

from .. import schema_config as schema
from .dependencies import get_repository
from .models import CaseFilter, CaseGraph, CaseOverview, CriticalityResponse, CaseSort, CaseSummary, CommunityDetail, CommunitySummary, GraphFilter, MetricName, NodeDetail, PathResponse, TopNodesResponse
from .narratives import community_narrative, criticality_narrative, path_narrative
from .repository import Neo4jRepository

app = FastAPI(title="Criminal Network Analysis API", version="1.0.0")
Repository = Annotated[Neo4jRepository, Depends(get_repository)]


@app.get("/cases", response_model=list[CaseSummary])
def list_cases(
    repository: Repository,
    filter: Annotated[CaseFilter | None, Query()] = None,
    sort: Annotated[CaseSort, Query()] = "last_activity",
) -> list[dict]:
    """Read Case metadata and scoped structural node/edge counts; metadata is null-safe."""
    return repository.list_cases(filter, sort)


@app.get("/cases/{case_id}/overview", response_model=CaseOverview)
def case_overview(case_id: str, repository: Repository) -> dict:
    """Read persisted Louvain modularity plus scoped counts and Section 6 flags."""
    result = repository.get_case_overview(case_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return result


METRIC_PROPERTIES = {
    "betweenness": schema.PROP_BETWEENNESS,
    "eigenvector": schema.PROP_EIGENVECTOR,
    "degree": schema.PROP_DEGREE,
}


@app.get("/cases/{case_id}/nodes/top", response_model=TopNodesResponse)
def top_nodes(
    case_id: str, repository: Repository,
    metric: Annotated[MetricName, Query()] = "betweenness",
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> dict:
    """Read persisted centrality scores; entity_type is schema-pending/null-safe."""
    return {"metric": metric, "results": repository.get_top_nodes(
        case_id, METRIC_PROPERTIES[metric], limit
    )}


@app.get("/cases/{case_id}/nodes/{node_id}", response_model=NodeDetail)
def node_detail(case_id: str, node_id: str, repository: Repository) -> dict:
    """Read persisted node scores/role and direct structural neighbors; subtype/date are null-safe."""
    result = repository.get_node_detail(case_id, node_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Node not found in case")
    return result


@app.get("/cases/{case_id}/graph", response_model=CaseGraph)
def case_graph(
    case_id: str, repository: Repository,
    filter: Annotated[GraphFilter | None, Query()] = None,
    cutoff: Annotated[float | None, Query(ge=0.0)] = None,
) -> dict:
    """Read persisted node metrics and Case graph metrics; filters are Cypher-side."""
    return repository.get_case_graph(case_id, filter == "bridging_only", cutoff)


@app.get("/cases/{case_id}/communities", response_model=list[CommunitySummary])
def communities(case_id: str, repository: Repository) -> list[dict]:
    """Read Louvain membership and persisted community densities; labels are generic."""
    return repository.get_communities(case_id)


@app.get("/cases/{case_id}/communities/{community_id}", response_model=CommunityDetail)
def community_detail(case_id: str, community_id: str, repository: Repository) -> dict:
    """Read persisted community metrics/members and add a traceable template narrative."""
    result = repository.get_community_detail(case_id, community_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Community not found in case")
    return {**result, "narrative": community_narrative(
        result["internal_density"], result["external_density"]
    )}


@app.get("/cases/{case_id}/path", response_model=PathResponse)
def path(
    case_id: str, repository: Repository,
    from_node_id: Annotated[str, Query(min_length=1)],
    to_node_id: Annotated[str, Query(min_length=1)],
) -> dict:
    """Find one scoped shortest path; strength is mean weight/(weight+1), not confidence."""
    result = repository.find_path(case_id, from_node_id, to_node_id)
    if not result["path_found"]:
        return {**result, "narrative": None}
    return {**result, "narrative": path_narrative(result["nodes"], result["steps"])}


@app.get("/cases/{case_id}/criticality", response_model=CriticalityResponse)
def criticality(
    case_id: str, repository: Repository,
    top_k: Annotated[Literal[3, 6, 10], Query()] = 6,
) -> dict:
    """Slice precomputed CriticalityRank nodes; this endpoint never runs simulation."""
    result = repository.get_criticality(case_id, top_k)
    if result["ranked_removals"]:
        first_name = result["ranked_removals"][0].get("node_name") or result["ranked_removals"][0]["node_id"]
        result["impact_narrative"] = criticality_narrative(first_name, result["final_state"])
    return result
