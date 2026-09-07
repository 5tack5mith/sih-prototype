from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CaseSummary(BaseModel):
    case_id: str
    name: str | None = None
    status: str | None = None
    priority: str | None = None
    description: str | None = None
    node_count: int
    edge_count: int
    updated_at: str | None = None
    lead_analyst: str | None = None
    jurisdiction_tag: str | None = None


class CaseOverview(BaseModel):
    case_id: str
    total_entities: int
    total_relationships: int
    community_count: int
    modularity: float | None = None
    structural_alert_count: int
    direct_1hop_count: int


class RankedNode(BaseModel):
    node_id: str
    name: str | None = None
    entity_type: str | None = None
    score: float | None = None
    rank: int


class TopNodesResponse(BaseModel):
    metric: Literal["betweenness", "eigenvector", "degree"]
    results: list[RankedNode]


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    weight: float | None = None


class EgoNetwork(BaseModel):
    nodes: list[str]
    edges: list[GraphEdge]


class NodeScores(BaseModel):
    betweenness: float | None = None
    eigenvector: float | None = None
    degree: float | None = None


class NodeDetail(BaseModel):
    node_id: str
    name: str | None = None
    entity_type: str | None = None
    first_contact_date: str | None = None
    scores: NodeScores
    community_id: str | None = None
    structural_role: str | None = None
    connection_count: int
    structural_alert_count: int
    ego_network: EgoNetwork


class GraphNode(BaseModel):
    node_id: str
    name: str | None = None
    entity_type: str | None = None
    betweenness: float | None = None
    degree: float | None = None
    eigenvector: float | None = None
    community_id: str | None = None
    structural_role: str | None = None


class GraphMetrics(BaseModel):
    density: float | None = None
    diameter: int | None = None
    reciprocity: float | None = None


class CaseGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    metrics: GraphMetrics


class CommunitySummary(BaseModel):
    community_id: str
    label: str
    size: int
    internal_density: float
    external_density: float
    member_node_ids: list[str]


class CommunityMember(BaseModel):
    node_id: str
    name: str | None = None
    entity_type: str | None = None
    centrality: float | None = None


class CommunityDetail(BaseModel):
    community_id: str
    size: int
    internal_density: float
    external_density: float
    members: list[CommunityMember]
    narrative: str


class PathStep(BaseModel):
    step: int
    from_: str | None = None
    to: str | None = None
    relationship_type: str
    detail: str

    model_config = {"populate_by_name": True}

    def model_dump(self, *args, **kwargs):
        kwargs.setdefault("by_alias", True)
        return super().model_dump(*args, **kwargs)


class PathResponse(BaseModel):
    path_found: bool
    hops: int | None = None
    connection_strength: float | None = None
    total_relationship_count: int
    nodes: list[str]
    steps: list[dict]
    narrative: str | None = None


class CriticalityRemoval(BaseModel):
    rank: int
    node_id: str
    node_name: str | None = None
    entity_type_label: str
    component_size_before: int
    component_size_after: int
    fragmentation_pct: float


class CriticalityFinalState(BaseModel):
    components_created: int
    largest_remaining_component: int
    overall_efficiency_drop_pct: float


class CriticalityResponse(BaseModel):
    case_id: str
    initial_node_count: int
    criterion: str
    ranked_removals: list[CriticalityRemoval]
    final_state: CriticalityFinalState
    impact_narrative: str | None = None
    note: str | None = None


class SuggestedLink(BaseModel):
    suggested_node_id: str
    suggested_name: str | None = None
    similarity_score: float


MetricName = Literal["betweenness", "eigenvector", "degree"]
CaseFilter = Literal["active", "archived", "flagged"]
CaseSort = Literal["last_activity", "name"]
GraphFilter = Literal["bridging_only"]
