from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query

from .dependencies import get_repository
from .models import CaseFilter, CaseOverview, CaseSort, CaseSummary
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
