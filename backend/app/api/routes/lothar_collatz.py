from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..container import ApiContainer
from ...dto.lothar_collatz import (
    ChartResponseDto,
    GenerateResponseDto,
    HealthResponseDto,
    PathResponseDto,
)
from ...services.lothar_collatz_service import (
    LotharCollatzCacheNotFoundError,
    LotharCollatzChartTypeError,
)

router = APIRouter(prefix='/api', tags=['lothar-collatz'])


@router.get('/health', response_model=HealthResponseDto)
def health() -> HealthResponseDto:
    return HealthResponseDto(status='ok')


@router.post('/generate', response_model=GenerateResponseDto)
def generate(
        limit: int = Query(..., gt=0, le=100_000_000),
        persist: bool = Query(True),
) -> GenerateResponseDto:
    service = ApiContainer.lothar_collatz_service()
    return service.generate(limit=limit, persist=persist)


@router.get('/charts/{chart_type}', response_model=ChartResponseDto)
def chart(
        chart_type: Literal['xy', 'network', 'tree'],
        limit: int | None = Query(None, gt=0, le=100_000_000),
        layers: int | None = Query(None, gt=0, le=512),
        source: Literal['auto', 'fresh', 'cache'] = Query('auto'),
        metric: Literal['steps', 'max_value'] = Query('steps'),
) -> ChartResponseDto:
    service = ApiContainer.lothar_collatz_service()
    try:
        return service.build_chart(
            chart_type=chart_type,
            limit=limit,
            source=source,
            metric=metric,
            layers=layers,
        )
    except LotharCollatzCacheNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except LotharCollatzChartTypeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get('/path', response_model=PathResponseDto)
def path(
        start_n: int = Query(..., gt=0, le=10_000_000),
) -> PathResponseDto:
    service = ApiContainer.lothar_collatz_service()
    try:
        return service.get_path(start_n=start_n)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
