"""add updated_by_id and updated_by_name columns to crm_records

Revision ID: 0008_crm_updated_by
Revises: 0007_add_bid_date_and_progress
Create Date: 2026-11-27 15:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0008_crm_updated_by'
down_revision: Union[str, None] = '0007_add_bid_date_and_progress'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'crm_records' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('crm_records')}
    if 'updated_by_id' not in existing_cols:
        op.add_column('crm_records', sa.Column('updated_by_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_crm_records_updated_by_id',
            'crm_records',
            'users',
            ['updated_by_id'],
            ['id'],
            ondelete='SET NULL',
        )
    if 'updated_by_name' not in existing_cols:
        op.add_column('crm_records', sa.Column('updated_by_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'crm_records' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('crm_records')}
    if 'updated_by_name' in existing_cols:
        op.drop_column('crm_records', 'updated_by_name')
    if 'updated_by_id' in existing_cols:
        op.drop_constraint('fk_crm_records_updated_by_id', 'crm_records', type_='foreignkey')
        op.drop_column('crm_records', 'updated_by_id')
