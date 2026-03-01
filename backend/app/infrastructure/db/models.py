from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class LotharCollatzGenerationModel(Base):
    __tablename__ = 'generations'
    __table_args__ = {'schema': 'collatz'}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    limit_value: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text('now()'),
    )
    longest_chain_start: Mapped[int] = mapped_column(Integer, nullable=False)
    longest_chain_length: Mapped[int] = mapped_column(Integer, nullable=False)
    highest_peak_start: Mapped[int] = mapped_column(Integer, nullable=False)
    highest_peak_value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    unique_node_count: Mapped[int] = mapped_column(Integer, nullable=False)
    unique_edge_count: Mapped[int] = mapped_column(Integer, nullable=False)

    sequences: Mapped[list['LotharCollatzSequenceModel']] = relationship(
        back_populates='generation',
        cascade='all, delete-orphan',
    )
    edges: Mapped[list['LotharCollatzEdgeModel']] = relationship(
        back_populates='generation',
        cascade='all, delete-orphan',
    )


class LotharCollatzSequenceModel(Base):
    __tablename__ = 'sequences'
    __table_args__ = (
        Index('idx_sequences_generation_id', 'generation_id'),
        {'schema': 'collatz'},
    )

    generation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('collatz.generations.id', ondelete='CASCADE'),
        primary_key=True,
    )
    start_n: Mapped[int] = mapped_column(Integer, primary_key=True)
    steps: Mapped[int] = mapped_column(Integer, nullable=False)
    max_value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    path: Mapped[list[int]] = mapped_column(ARRAY(BigInteger), nullable=False)

    generation: Mapped['LotharCollatzGenerationModel'] = relationship(
        back_populates='sequences'
    )


class LotharCollatzEdgeModel(Base):
    __tablename__ = 'edges'
    __table_args__ = (
        Index('idx_edges_generation_id', 'generation_id'),
        {'schema': 'collatz'},
    )

    generation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('collatz.generations.id', ondelete='CASCADE'),
        primary_key=True,
    )
    source_value: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    target_value: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)

    generation: Mapped['LotharCollatzGenerationModel'] = relationship(
        back_populates='edges'
    )
