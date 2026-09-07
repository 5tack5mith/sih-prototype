"""Deterministic Zone 2 templates; every stated number comes from response fields."""


def community_narrative(internal_density: float, external_density: float) -> str:
    ratio = float("inf") if external_density == 0 and internal_density > 0 else (internal_density / external_density if external_density else 0.0)
    if ratio >= 2.0:
        pattern = "a tightly coordinated group with limited outside contact"
    elif ratio >= 1.0:
        pattern = "a group with stronger internal than external connectivity"
    else:
        pattern = "a group whose outside connectivity matches or exceeds its internal connectivity"
    return (f"This community has internal density {internal_density:.2f} and external "
            f"density {external_density:.2f}, a pattern consistent with {pattern}.")
