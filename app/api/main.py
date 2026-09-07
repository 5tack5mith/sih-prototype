from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query

from .. import schema_config as schema
from .dependencies import get_repository
from .models import CaseFilter, CaseOverview, CaseSort, CaseSummary, MetricName, NodeDetail, TopNodesResponse
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
