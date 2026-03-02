"""init_lothar_collatz

Revision ID: 74bba77944e1
Revises: 
Create Date: 2026-03-01 22:47:19.473601
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '74bba77944e1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text('CREATE SCHEMA IF NOT EXISTS collatz'))

    op.create_table(
        'generations',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('limit_value', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column('longest_chain_start', sa.Integer(), nullable=False),
        sa.Column('longest_chain_length', sa.Integer(), nullable=False),
        sa.Column('highest_peak_start', sa.Integer(), nullable=False),
        sa.Column('highest_peak_value', sa.BigInteger(), nullable=False),
        sa.Column('unique_node_count', sa.Integer(), nullable=False),
        sa.Column('unique_edge_count', sa.Integer(), nullable=False),
        sa.UniqueConstraint('limit_value', name='uq_generations_limit_value'),
        schema='collatz',
    )

    op.create_table(
        'sequences',
        sa.Column('generation_id', sa.BigInteger(), nullable=False),
        sa.Column('start_n', sa.Integer(), nullable=False),
        sa.Column('steps', sa.Integer(), nullable=False),
        sa.Column('max_value', sa.BigInteger(), nullable=False),
        sa.Column('path', postgresql.ARRAY(sa.BigInteger()), nullable=False),
        sa.ForeignKeyConstraint(
            ('generation_id',),
            ('collatz.generations.id',),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('generation_id', 'start_n', name='pk_sequences'),
        schema='collatz',
    )
    op.create_index(
        'idx_sequences_generation_id',
        'sequences',
        ['generation_id'],
        unique=False,
        schema='collatz',
    )

    op.create_table(
        'edges',
        sa.Column('generation_id', sa.BigInteger(), nullable=False),
        sa.Column('source_value', sa.BigInteger(), nullable=False),
        sa.Column('target_value', sa.BigInteger(), nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ('generation_id',),
            ('collatz.generations.id',),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint(
            'generation_id',
            'source_value',
            'target_value',
            name='pk_edges',
        ),
        schema='collatz',
    )
    op.create_index(
        'idx_edges_generation_id',
        'edges',
        ['generation_id'],
        unique=False,
        schema='collatz',
    )


def downgrade() -> None:
    op.drop_index('idx_edges_generation_id', table_name='edges', schema='collatz')
    op.drop_table('edges', schema='collatz')

    op.drop_index('idx_sequences_generation_id', table_name='sequences', schema='collatz')
    op.drop_table('sequences', schema='collatz')

    op.drop_table('generations', schema='collatz')
