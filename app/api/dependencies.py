from collections.abc import Iterator

from .repository import Neo4jRepository
from ..database import create_driver


def get_repository() -> Iterator[Neo4jRepository]:
    """Yield a request-scoped repository and always close its Neo4j driver."""
    driver = create_driver()
    try:
        yield Neo4jRepository(driver)
    finally:
        driver.close()
