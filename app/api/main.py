from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query

from .. import schema_config as schema
from ..auth import router as auth_router, get_current_user, init_db, require_admin
from ..auth.database import (assigned_case_ids, assign_investigator, get_user, list_assignments, remove_assignment, remove_case_assignments)
from .dependencies import get_repository, require_case_access
from .models import CaseAssignment, CaseCreate, CaseMetadataResponse, CaseMetadataUpdate, CaseStatusResponse, CaseFilter, CaseGraph, CaseOverview, CriticalityResponse, CaseSort, CaseSummary, CommunityDetail, CommunitySummary, GraphFilter, MetricName, NodeDetail, PathResponse, SuggestedLink, TopNodesResponse
from .narratives import community_narrative, criticality_narrative, path_narrative
from .repository import Neo4jRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Criminal Network Analysis API", version="1.0.0", lifespan=lifespan)
Repository = Annotated[Neo4jRepository, Depends(get_repository)]
CurrentUser = Annotated[dict, Depends(get_current_user)]
CaseAccess = Annotated[dict, Depends(require_case_access)]

app.include_router(auth_router)


@app.get("/cases", response_model=list[CaseSummary])
def list_cases(
    repository: Repository,
    user: CurrentUser,
    filter: Annotated[CaseFilter | None, Query()] = None,
    sort: Annotated[CaseSort, Query()] = "last_activity",
) -> list[dict]:
    """Read Case metadata and scoped structural node/edge counts; metadata is null-safe."""
    if user["role"] == "admin":
        return repository.list_cases(filter, sort)
    # Investigators may enumerate only assigned ACTIVE cases. Archive retains
    # assignment rows, but those cases must not appear in investigator lists.
    investigator_filter = "active" if filter in (None, "archived") else filter
    rows = repository.list_cases(
        investigator_filter, sort, assigned_case_ids(user["username"])
    )
    return [row for row in rows if (row.get("status") or "").upper() != "ARCHIVED"]


@app.post("/cases", response_model=CaseSummary, status_code=201)
def create_case(
    payload: CaseCreate,
    repository: Repository,
    admin: Annotated[dict, Depends(require_admin)],
) -> dict:
    """Create an empty ACTIVE case. Admin only. Case identity is assigned by the store."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Case name is required.")
    description = payload.description
    if isinstance(description, str):
        description = description.strip() or None
    result = repository.create_case(
        name,
        payload.priority,
        description,
        payload.jurisdiction_tag,
        admin["username"],
        datetime.now(timezone.utc).isoformat(),
    )
    if result is None:
        raise HTTPException(status_code=409, detail="Unable to allocate a unique case ID")
    return result


@app.patch("/cases/{case_id}", response_model=CaseMetadataResponse)
def update_case(
    case_id: str,
    payload: CaseMetadataUpdate,
    repository: Repository,
    _admin: Annotated[dict, Depends(require_admin)],
    _: CaseAccess,
) -> dict:
    """Update case metadata only; graph data and case identity stay unchanged. Admin only."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Case name is required.")
    description = payload.description
    if isinstance(description, str):
        description = description.strip() or None
    result = repository.update_case_metadata(
        case_id,
        name,
        payload.priority,
        description,
        payload.jurisdiction_tag,
        datetime.now(timezone.utc).isoformat(),
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return result
    return repository.list_cases(
        filter,
        sort,
        assigned_case_ids(user["username"]),
        ["active", "important"],
    )


@app.get("/cases/{case_id}/overview", response_model=CaseOverview)
def case_overview(case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess) -> dict:
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
    case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess,
    metric: Annotated[MetricName, Query()] = "betweenness",
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> dict:
    """Read persisted centrality scores; entity_type is schema-pending/null-safe."""
    return {"metric": metric, "results": repository.get_top_nodes(
        case_id, METRIC_PROPERTIES[metric], limit
    )}


@app.get("/cases/{case_id}/nodes/{node_id}", response_model=NodeDetail)
def node_detail(case_id: str, node_id: str, repository: Repository, user: CurrentUser, _: CaseAccess) -> dict:
    """Read persisted node scores/role and direct structural neighbors; subtype/date are null-safe."""
    result = repository.get_node_detail(case_id, node_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Node not found in case")
    return result


@app.get("/cases/{case_id}/graph", response_model=CaseGraph)
def case_graph(
    case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess,
    filter: Annotated[GraphFilter | None, Query()] = None,
    cutoff: Annotated[float | None, Query(ge=0.0)] = None,
) -> dict:
    """Read persisted node metrics and Case graph metrics; filters are Cypher-side."""
    return repository.get_case_graph(case_id, filter == "bridging_only", cutoff)


@app.get("/cases/{case_id}/communities", response_model=list[CommunitySummary])
def communities(case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess) -> list[dict]:
    """Read Louvain membership and persisted community densities; labels are generic."""
    return repository.get_communities(case_id)


@app.get("/cases/{case_id}/communities/{community_id}", response_model=CommunityDetail)
def community_detail(case_id: str, community_id: str, repository: Repository, user: CurrentUser, _: CaseAccess) -> dict:
    """Read persisted community metrics/members and add a traceable template narrative."""
    result = repository.get_community_detail(case_id, community_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Community not found in case")
    return {**result, "narrative": community_narrative(
        result["internal_density"], result["external_density"]
    )}


@app.get("/cases/{case_id}/path", response_model=PathResponse)
def path(
    case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess,
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
    case_id: str, repository: Repository, user: CurrentUser, _: CaseAccess,
    top_k: Annotated[int, Query()] = 6,
) -> dict:
    """Slice precomputed CriticalityRank nodes; this endpoint never runs simulation."""
    if top_k not in {3, 6, 10}:
        raise HTTPException(status_code=422, detail="top_k must be one of 3, 6, or 10")
    result = repository.get_criticality(case_id, top_k)
    if result["ranked_removals"]:
        first_name = result["ranked_removals"][0].get("node_name") or result["ranked_removals"][0]["node_id"]
        result["impact_narrative"] = criticality_narrative(first_name, result["final_state"])
    return result


@app.get("/cases/{case_id}/nodes/{node_id}/suggested_links", response_model=list[SuggestedLink])
def suggested_links(case_id: str, node_id: str, repository: Repository, user: CurrentUser, _: CaseAccess) -> list[dict]:
    """Read persisted Jaccard SIMILAR_TO candidates; results are suggestions, not facts."""
    return repository.get_suggested_links(case_id, node_id)


@app.get("/cases/{case_id}/assignments", response_model=list[CaseAssignment])
def get_assignments(case_id: str, _: dict = Depends(require_admin), repository: Repository = None) -> list[dict]:
    if repository.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return list_assignments(case_id)


@app.put("/cases/{case_id}/assignments/{username}", response_model=list[CaseAssignment])
def assign_case(case_id: str, username: str, admin: dict = Depends(require_admin), repository: Repository = None) -> list[dict]:
    case = repository.get_case(case_id)
    if case is None or (case.get("status") or "").upper() == "COMPLETED":
        raise HTTPException(status_code=404, detail="Case not found")
    assignee = get_user(username)
    if assignee is None:
        raise HTTPException(status_code=404, detail="Investigator not found")
    if assignee["role"] != "investigator":
        raise HTTPException(status_code=422, detail="Only investigators can be assigned")
    assign_investigator(case_id, username, admin["username"])
    return list_assignments(case_id)


@app.delete("/cases/{case_id}/assignments/{username}", status_code=204)
def unassign_case(case_id: str, username: str, _: dict = Depends(require_admin), repository: Repository = None) -> None:
    if repository.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if not remove_assignment(case_id, username):
        raise HTTPException(status_code=404, detail="Assignment not found")


@app.post("/cases/{case_id}/important", response_model=CaseStatusResponse)
def mark_case_important(case_id: str, _: dict = Depends(require_admin), repository: Repository = None) -> dict:
    case = repository.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if (case.get("status") or "").upper() == "COMPLETED":
        raise HTTPException(status_code=409, detail="Restore the completed case before marking it important")
    result = repository.set_case_status(case_id, "IMPORTANT")
    return result


@app.post("/cases/{case_id}/complete", response_model=CaseStatusResponse)
def complete_case(case_id: str, _: dict = Depends(require_admin), repository: Repository = None) -> dict:
    result = repository.set_case_status(case_id, "COMPLETED")
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return result


@app.post("/cases/{case_id}/restore", response_model=CaseStatusResponse)
def restore_case(case_id: str, _: dict = Depends(require_admin), repository: Repository = None) -> dict:
    result = repository.set_case_status(case_id, "ACTIVE")
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return result


@app.delete("/cases/{case_id}", status_code=204)
def purge_case(case_id: str, _: dict = Depends(require_admin), repository: Repository = None) -> None:
    try:
        deleted = repository.purge_completed_case(case_id)
    except ValueError:
        raise HTTPException(status_code=409, detail="Case must be completed before purging")
    if not deleted:
        raise HTTPException(status_code=404, detail="Case not found")
    remove_case_assignments(case_id)
