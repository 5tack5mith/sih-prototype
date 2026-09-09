from collections.abc import Iterator

from fastapi import Depends, HTTPException

from ..auth.database import has_assignment
from ..auth.dependencies import get_current_user
from .repository import Neo4jRepository
from ..database import create_driver


def get_repository() -> Iterator[Neo4jRepository]:
    """Yield a request-scoped repository and always close its Neo4j driver."""
    driver = create_driver()
    try:
        yield Neo4jRepository(driver)
    finally:
        driver.close()


def require_case_access(
    case_id: str,
    repository: Neo4jRepository = Depends(get_repository),
    user: dict = Depends(get_current_user),
) -> dict:
    """Authorize a case while concealing inaccessible cases from investigators."""
    case = repository.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "admin":
        return case
    if (case.get("status") or "").upper() == "ARCHIVED" or not has_assignment(case_id, user["username"]):
        raise HTTPException(status_code=404, detail="Case not found")
    return case
