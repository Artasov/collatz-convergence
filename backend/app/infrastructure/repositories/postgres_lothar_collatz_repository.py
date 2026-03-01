from __future__ import annotations

from typing import Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...domain.lothar_collatz import (
    LotharCollatzGeneration,
    LotharCollatzSequence,
    LotharCollatzSummary,
)
from ...domain.repositories import LotharCollatzRepository
from ..db.models import (
    LotharCollatzEdgeModel,
    LotharCollatzGenerationModel,
    LotharCollatzSequenceModel,
)
from ..db.session import SqlAlchemySessionFactory


class PostgresLotharCollatzRepository(LotharCollatzRepository):
    def __init__(self, session_factory: SqlAlchemySessionFactory) -> None:
        self.session_factory = session_factory

    def save(self, generation: LotharCollatzGeneration) -> None:
        with self.session_factory.create_session() as session:
            current = session.execute(
                select(LotharCollatzGenerationModel).where(
                    LotharCollatzGenerationModel.__table__.c.limit_value == generation.limit
                )
            ).scalar_one_or_none()

            if current is not None:
                session.delete(current)
                session.flush()

            summary = generation.summary
            generation_model = LotharCollatzGenerationModel(
                limit_value=generation.limit,
                longest_chain_start=summary.longest_chain_start,
                longest_chain_length=summary.longest_chain_length,
                highest_peak_start=summary.highest_peak_start,
                highest_peak_value=summary.highest_peak_value,
                unique_node_count=summary.unique_node_count,
                unique_edge_count=summary.unique_edge_count,
            )
            session.add(generation_model)
            session.flush()

            sequence_models = [
                LotharCollatzSequenceModel(
                    generation_id=generation_model.id,
                    start_n=sequence.start_n,
                    steps=sequence.steps,
                    max_value=sequence.max_value,
                    path=list(sequence.path),
                )
                for sequence in generation.sequences.values()
            ]
            edge_models = [
                LotharCollatzEdgeModel(
                    generation_id=generation_model.id,
                    source_value=source,
                    target_value=target,
                    weight=weight,
                )
                for (source, target), weight in generation.edges.items()
            ]
            session.add_all(sequence_models)
            session.add_all(edge_models)
            session.commit()

    def load_by_limit(self, limit: int) -> Optional[LotharCollatzGeneration]:
        with self.session_factory.create_session() as session:
            generation_model = session.execute(
                select(LotharCollatzGenerationModel)
                .where(LotharCollatzGenerationModel.__table__.c.limit_value == limit)
                .options(
                    selectinload(LotharCollatzGenerationModel.sequences),
                    selectinload(LotharCollatzGenerationModel.edges),
                )
            ).scalar_one_or_none()

            if generation_model is None:
                return None

            sequences = {
                row.start_n: LotharCollatzSequence(
                    start_n=row.start_n,
                    steps=row.steps,
                    max_value=row.max_value,
                    path=tuple(row.path),
                )
                for row in generation_model.sequences
            }
            edges: Dict[Tuple[int, int], int] = {
                (row.source_value, row.target_value): row.weight
                for row in generation_model.edges
            }
            nodes = sorted(
                {
                    value
                    for sequence in sequences.values()
                    for value in sequence.path
                }
            )

            summary = LotharCollatzSummary(
                limit=limit,
                longest_chain_start=generation_model.longest_chain_start,
                longest_chain_length=generation_model.longest_chain_length,
                highest_peak_start=generation_model.highest_peak_start,
                highest_peak_value=generation_model.highest_peak_value,
                unique_node_count=generation_model.unique_node_count,
                unique_edge_count=generation_model.unique_edge_count,
            )
            return LotharCollatzGeneration(
                limit=limit,
                sequences=sequences,
                nodes=tuple(nodes),
                edges=edges,
                summary=summary,
            )
