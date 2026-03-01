from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Any, Dict, List

from .lothar_collatz import LotharCollatzGeneration


class LotharCollatzChartBuilder(ABC):
    chart_type: str

    @abstractmethod
    def build(self, generation: LotharCollatzGeneration) -> Dict[str, Any]:
        raise NotImplementedError


class LotharCollatzXYChartBuilder(LotharCollatzChartBuilder):
    chart_type = 'xy'

    def __init__(self, metric: str = 'steps') -> None:
        metrics = {'steps', 'max_value'}
        if metric not in metrics:
            raise ValueError(f'Unsupported metric {metric}. Allowed: {metrics}.')
        self.metric = metric

    def build(self, generation: LotharCollatzGeneration) -> Dict[str, Any]:
        points: List[Dict[str, int]] = []
        for start_n in range(1, generation.limit + 1):
            sequence = generation.sequences[start_n]
            y_value = sequence.steps if self.metric == 'steps' else sequence.max_value
            points.append(
                {
                    'x': start_n,
                    'y': y_value,
                    'steps': sequence.steps,
                    'max_value': sequence.max_value,
                }
            )

        y_label = 'Steps to 1' if self.metric == 'steps' else 'Peak value'
        return {
            'metric': self.metric,
            'x_label': 'Start n',
            'y_label': y_label,
            'points': points,
        }


class LotharCollatzNetworkChartBuilder(LotharCollatzChartBuilder):
    chart_type = 'network'

    def build(self, generation: LotharCollatzGeneration) -> Dict[str, Any]:
        hit_counter: Dict[int, int] = {}
        steps_to_one: Dict[int, int] = {}
        for sequence in generation.sequences.values():
            path_length = len(sequence.path)
            for index, value in enumerate(sequence.path):
                hit_counter[value] = hit_counter.get(value, 0) + 1
                if value not in steps_to_one:
                    steps_to_one[value] = path_length - index - 1

        nodes = [
            {
                'id': str(value),
                'value': value,
                'hits': hit_counter.get(value, 0),
                'steps_to_1': steps_to_one.get(value, 0),
            }
            for value in generation.nodes
        ]

        edges = [
            {
                'source': str(source),
                'target': str(target),
                'weight': weight,
            }
            for (source, target), weight in generation.edges.items()
        ]
        return {'root': '1', 'nodes': nodes, 'edges': edges}


class LotharCollatzTreeChartBuilder(LotharCollatzChartBuilder):
    chart_type = 'tree'

    @staticmethod
    def _predecessors(value: int) -> list[int]:
        predecessors = [value * 2]
        if value > 1 and (value - 1) % 3 == 0:
            odd_candidate = (value - 1) // 3
            if odd_candidate > 0 and odd_candidate % 2 == 1:
                predecessors.append(odd_candidate)
        return sorted(set(predecessors), reverse=True)

    @staticmethod
    def _build_trunk(node_set: set[int]) -> set[int]:
        trunk = {1}
        value = 1
        while value * 2 in node_set:
            value *= 2
            trunk.add(value)
        return trunk

    def build(self, generation: LotharCollatzGeneration) -> Dict[str, Any]:
        return self.build_from_layers(layers=generation.limit)

    def build_from_layers(self, layers: int) -> Dict[str, Any]:
        if layers <= 0:
            raise ValueError('layers must be positive.')

        node_set: set[int] = {1}
        nodes_by_depth: dict[int, list[int]] = {0: [1]}
        depth_by_value: Dict[int, int] = {1: 0}
        parent_by_node: Dict[int, int] = {}
        edge_set: set[tuple[int, int]] = set()

        for depth in range(1, layers):
            current_layer: list[int] = []
            previous_layer = nodes_by_depth.get(depth - 1, [])
            for target in previous_layer:
                for source in self._predecessors(target):
                    edge_set.add((source, target))
                    if source in depth_by_value:
                        continue
                    depth_by_value[source] = depth
                    parent_by_node[source] = target
                    node_set.add(source)
                    current_layer.append(source)

            deduped: list[int] = []
            seen: set[int] = set()
            for value in current_layer:
                if value in seen:
                    continue
                seen.add(value)
                deduped.append(value)
            nodes_by_depth[depth] = deduped

        max_depth = max(depth_by_value.values()) if depth_by_value else 0
        trunk = self._build_trunk(node_set)

        x_unit_by_value: Dict[int, float] = {1: 0.0}
        min_gap = 1.04
        sibling_gap = 1.0

        for depth in range(1, max_depth + 1):
            layer_nodes = nodes_by_depth.get(depth, [])
            if not layer_nodes:
                continue

            children_by_parent: dict[int, list[int]] = defaultdict(list)
            for node in layer_nodes:
                parent = parent_by_node.get(node, 1)
                children_by_parent[parent].append(node)

            ordered_parents = sorted(
                children_by_parent,
                key=lambda parent: (x_unit_by_value.get(parent, 0.0), parent),
            )

            target_x_by_node: Dict[int, float] = {}
            for parent in ordered_parents:
                children = sorted(children_by_parent[parent], reverse=True)
                parent_x = x_unit_by_value.get(parent, 0.0)
                midpoint = (len(children) - 1) / 2.0
                for index, child in enumerate(children):
                    target_x_by_node[child] = parent_x + (index - midpoint) * sibling_gap

            ordered_nodes = sorted(
                layer_nodes,
                key=lambda node: (target_x_by_node.get(node, 0.0), node),
            )

            placed_x_by_node: Dict[int, float] = {}
            previous_x: float | None = None
            for node in ordered_nodes:
                current_x = target_x_by_node.get(node, 0.0)
                if previous_x is not None and current_x < previous_x + min_gap:
                    current_x = previous_x + min_gap
                placed_x_by_node[node] = current_x
                previous_x = current_x

            parent_mean = sum(
                x_unit_by_value.get(parent_by_node.get(node, 1), 0.0) for node in ordered_nodes
            ) / len(ordered_nodes)
            layer_mean = sum(placed_x_by_node[node] for node in ordered_nodes) / len(ordered_nodes)
            shift = parent_mean - layer_mean

            for node in ordered_nodes:
                x_unit_by_value[node] = placed_x_by_node[node] + shift

        min_x = min(x_unit_by_value.get(value, 0.0) for value in node_set)
        max_x = max(x_unit_by_value.get(value, 0.0) for value in node_set)
        span = max_x - min_x
        if span <= 0:
            x_by_value = {value: 0.5 for value in node_set}
        else:
            x_by_value = {
                value: (x_unit_by_value.get(value, 0.0) - min_x) / span for value in node_set
            }

        nodes = []
        for value in sorted(node_set):
            kind = 'root' if value == 1 else 'trunk' if value in trunk else 'branch'
            nodes.append(
                {
                    'id': str(value),
                    'value': value,
                    'hits': 1,
                    'depth': depth_by_value.get(value, 0),
                    'x': x_by_value.get(value, 0.5),
                    'kind': kind,
                }
            )

        edges = [
            {
                'source': str(source),
                'target': str(target),
                'weight': 1,
            }
            for source, target in sorted(edge_set)
        ]

        if layers >= 3 and 4 in node_set:
            edges.append(
                {
                    'source': '1',
                    'target': '4',
                    'weight': 1,
                }
            )

        return {
            'root': '1',
            'layers': layers,
            'max_depth': max_depth,
            'nodes': nodes,
            'edges': edges,
        }
