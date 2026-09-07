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


def path_narrative(nodes: list[str], steps: list[dict]) -> str | None:
    if not steps:
        return None
    route = "; ".join(
        f"{step.get('from') or 'Unknown'} --{step['relationship_type']}-- {step.get('to') or 'Unknown'}"
        for step in steps
    )
    return (f"{steps[0].get('from') or nodes[0]} and {steps[-1].get('to') or nodes[-1]} "
            f"are connected by a {len(steps)}-hop path: {route}.")


def criticality_narrative(node_name: str, final_state: dict) -> str:
    return (f"The precomputed sequence beginning with {node_name} fragments the network into "
            f"{final_state['components_created']} disconnected components, with the largest "
            f"remaining component at {final_state['largest_remaining_component']} nodes and "
            f"global efficiency reduced by {final_state['overall_efficiency_drop_pct']:.1f}%.")
