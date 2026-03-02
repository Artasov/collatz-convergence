from __future__ import annotations

from collections import Counter

from ..domain.charts import (
    LotharCollatzNetworkChartBuilder,
    LotharCollatzTreeChartBuilder,
    LotharCollatzXYChartBuilder,
)
from ..domain.lothar_collatz import LotharCollatzGeneration, LotharCollatzGenerator
from ..domain.repositories import LotharCollatzRepository
from ..dto.lothar_collatz import (
    ChartResponseDto,
    GenerateResponseDto,
    LotharCollatzSummaryDto,
    PathPointDto,
    PathResponseDto,
)


class LotharCollatzCacheNotFoundError(Exception):
    pass


class LotharCollatzChartTypeError(Exception):
    pass


class LotharCollatzService:
    def __init__(
            self,
            generator: LotharCollatzGenerator,
            repository: LotharCollatzRepository,
    ) -> None:
        self.generator = generator
        self.repository = repository

    def generate(self, limit: int, persist: bool) -> GenerateResponseDto:
        generation = self.generator.generate_up_to(limit)
        if persist:
            self.repository.save(generation)
        return GenerateResponseDto(
            limit=limit,
            persisted=persist,
            summary=self._build_summary(generation),
        )

    def get_path(self, start_n: int) -> PathResponseDto:
        path = list(self.generator.sequence(start_n))
        points = [
            PathPointDto(
                step=index,
                value=value,
            )
            for index, value in enumerate(path)
        ]
        return PathResponseDto(
            start_n=start_n,
            steps=len(path) - 1,
            peak_value=max(path),
            path=path,
            points=points,
        )

    def build_chart(
            self,
            chart_type: str,
            limit: int | None,
            source: str,
            metric: str,
            layers: int | None = None,
    ) -> ChartResponseDto:
        if chart_type == 'tree':
            safe_layers = 12 if layers is None else layers
            if safe_layers <= 0:
                raise ValueError('layers must be positive.')
            builder = LotharCollatzTreeChartBuilder()
            data = builder.build_from_layers(layers=safe_layers)
            summary = self._build_tree_summary(data=data, layers=safe_layers)
            return ChartResponseDto(
                chart_type=chart_type,
                limit=safe_layers,
                summary=summary,
                data=data,
            )

        if limit is None:
            raise ValueError('limit is required for this chart type.')

        generation = self._load_generation(limit=limit, source=source)

        if chart_type == 'xy':
            builder = LotharCollatzXYChartBuilder(metric=metric)
        elif chart_type == 'network':
            builder = LotharCollatzNetworkChartBuilder()
        else:
            raise LotharCollatzChartTypeError(f'Unsupported chart type: {chart_type}')

        data = builder.build(generation)
        data['value_histogram'] = self._build_value_histogram(generation)

        return ChartResponseDto(
            chart_type=chart_type,
            limit=limit,
            summary=self._build_summary(generation),
            data=data,
        )

    def _load_generation(self, limit: int, source: str) -> LotharCollatzGeneration:
        if source == 'fresh':
            return self.generator.generate_up_to(limit)

        cached = self.repository.load_by_limit(limit)
        if source == 'cache':
            if cached is None:
                raise LotharCollatzCacheNotFoundError(
                    f'No cached generation for limit={limit}. Call POST /api/generate first.'
                )
            return cached

        if cached is not None:
            return cached
        return self.generator.generate_up_to(limit)

    @staticmethod
    def _build_summary(generation: LotharCollatzGeneration) -> LotharCollatzSummaryDto:
        summary = generation.summary
        return LotharCollatzSummaryDto(
            limit=summary.limit,
            longest_chain_start=summary.longest_chain_start,
            longest_chain_length=summary.longest_chain_length,
            highest_peak_start=summary.highest_peak_start,
            highest_peak_value=summary.highest_peak_value,
            unique_node_count=summary.unique_node_count,
            unique_edge_count=summary.unique_edge_count,
        )

    @staticmethod
    def _build_value_histogram(generation: LotharCollatzGeneration) -> list[dict[str, int]]:
        counter: Counter[int] = Counter()
        for sequence in generation.sequences.values():
            counter.update(sequence.path)

        return [
            {
                'value': value,
                'hits': hits,
            }
            for value, hits in sorted(counter.items(), key=lambda item: item[0])
        ]

    @staticmethod
    def _build_tree_summary(data: dict, layers: int) -> LotharCollatzSummaryDto:
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])
        max_value = max((node.get('value', 1) for node in nodes), default=1)
        max_depth = max((node.get('depth', 0) for node in nodes), default=0)
        return LotharCollatzSummaryDto(
            limit=layers,
            longest_chain_start=1,
            longest_chain_length=max_depth,
            highest_peak_start=max_value,
            highest_peak_value=max_value,
            unique_node_count=len(nodes),
            unique_edge_count=len(edges),
        )
