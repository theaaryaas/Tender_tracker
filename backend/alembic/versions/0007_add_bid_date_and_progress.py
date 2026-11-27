"""add bid_date and bid_progress columns to tenders

Revision ID: 0007_add_bid_date_and_progress
Revises: 0006_crm_approval_pipeline
Create Date: 2026-11-27 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0007_add_bid_date_and_progress'
down_revision: Union[str, None] = '0006_crm_approval_pipeline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'tenders' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('tenders')}
    if 'bid_date' not in existing_cols:
        op.add_column('tenders', sa.Column('bid_date', sa.String(length=60), nullable=True))
    if 'bid_progress' not in existing_cols:
        op.add_column('tenders', sa.Column('bid_progress', sa.String(length=80), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'tenders' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('tenders')}
    if 'bid_progress' in existing_cols:
        op.drop_column('tenders', 'bid_progress')
    if 'bid_date' in existing_cols:
        op.drop_column('tenders', 'bid_date')

