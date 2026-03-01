from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Dict, Iterable, Tuple


@dataclass(frozen=True)
class LotharCollatzSequence:
    start_n: int
    path: Tuple[int, ...]
    steps: int
    max_value: int


@dataclass(frozen=True)
class LotharCollatzSummary:
    limit: int
    longest_chain_start: int
    longest_chain_length: int
    highest_peak_start: int
    highest_peak_value: int
    unique_node_count: int
    unique_edge_count: int


@dataclass(frozen=True)
class LotharCollatzGeneration:
    limit: int
    sequences: Dict[int, LotharCollatzSequence]
    nodes: Tuple[int, ...]
    edges: Dict[Tuple[int, int], int]
    summary: LotharCollatzSummary


class LotharCollatzGenerator:
    def __init__(self) -> None:
        self._length_cache: Dict[int, int] = {1: 0}
        self._peak_cache: Dict[int, int] = {1: 1}

    @staticmethod
    def next_value(value: int) -> int:
        if value <= 0:
            raise ValueError('Lothar-Collatz is defined for positive integers only.')
        if value % 2 == 0:
            return value // 2
        return 3 * value + 1

    def _compute_stats(self, start_n: int) -> Tuple[int, int]:
        if start_n in self._length_cache:
            return self._length_cache[start_n], self._peak_cache[start_n]

        chain: list[int] = []
        value = start_n
        while value not in self._length_cache:
            chain.append(value)
            value = self.next_value(value)

        known_length = self._length_cache[value]
        known_peak = self._peak_cache[value]
        for current in reversed(chain):
            known_length += 1
            known_peak = max(current, known_peak)
            self._length_cache[current] = known_length
            self._peak_cache[current] = known_peak

        return self._length_cache[start_n], self._peak_cache[start_n]

    def sequence(self, start_n: int) -> Tuple[int, ...]:
        if start_n <= 0:
            raise ValueError('start_n must be positive.')
        path = [start_n]
        value = start_n
        while value != 1:
            value = self.next_value(value)
            path.append(value)
        return tuple(path)

    def generate_up_to(self, limit: int) -> LotharCollatzGeneration:
        if limit <= 0:
            raise ValueError('limit must be positive.')

        sequences: Dict[int, LotharCollatzSequence] = {}
        node_set: set[int] = set()
        edge_counter: Counter[Tuple[int, int]] = Counter()
        longest_chain_start = 1
        longest_chain_length = 0
        highest_peak_start = 1
        highest_peak_value = 1

        for number in range(1, limit + 1):
            steps, peak = self._compute_stats(number)
            path = self.sequence(number)

            if steps > longest_chain_length:
                longest_chain_length = steps
                longest_chain_start = number
            if peak > highest_peak_value:
                highest_peak_value = peak
                highest_peak_start = number

            sequences[number] = LotharCollatzSequence(
                start_n=number,
                path=path,
                steps=steps,
                max_value=peak,
            )

            node_set.update(path)
            edge_counter.update(zip(path[:-1], path[1:]))

        summary = LotharCollatzSummary(
            limit=limit,
            longest_chain_start=longest_chain_start,
            longest_chain_length=longest_chain_length,
            highest_peak_start=highest_peak_start,
            highest_peak_value=highest_peak_value,
            unique_node_count=len(node_set),
            unique_edge_count=len(edge_counter),
        )

        return LotharCollatzGeneration(
            limit=limit,
            sequences=sequences,
            nodes=tuple(sorted(node_set)),
            edges=dict(edge_counter),
            summary=summary,
        )

    @staticmethod
    def sequence_iter(start_n: int) -> Iterable[int]:
        value = start_n
        if value <= 0:
            raise ValueError('start_n must be positive.')
        yield value
        while value != 1:
            value = LotharCollatzGenerator.next_value(value)
            yield value

