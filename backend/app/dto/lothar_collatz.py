from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel


class HealthResponseDto(BaseModel):
    status: str


class LotharCollatzSummaryDto(BaseModel):
    limit: int
    longest_chain_start: int
    longest_chain_length: int
    highest_peak_start: int
    highest_peak_value: int
    unique_node_count: int
    unique_edge_count: int


class GenerateResponseDto(BaseModel):
    limit: int
    persisted: bool
    summary: LotharCollatzSummaryDto


class ChartResponseDto(BaseModel):
    chart_type: str
    limit: int
    summary: LotharCollatzSummaryDto
    data: Dict[str, Any]


class PathPointDto(BaseModel):
    step: int
    value: int


class PathResponseDto(BaseModel):
    start_n: int
    steps: int
    peak_value: int
    path: list[int]
    points: list[PathPointDto]
