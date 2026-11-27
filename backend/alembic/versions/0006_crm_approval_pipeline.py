"""add approval_status and pipeline_stage columns to crm_records

Revision ID: 0006_crm_approval_pipeline
Revises: 0005_add_docs_deep_analysis
Create Date: 2026-11-27 12:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006_crm_approval_pipeline'
down_revision: Union[str, None] = '0005_add_docs_deep_analysis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'crm_records' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('crm_records')}
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('crm_records')}

    if 'approval_status' not in existing_cols:
        op.add_column(
            'crm_records',
            sa.Column('approval_status', sa.String(length=20), server_default='Pending', nullable=False)
        )
    if op.f('ix_crm_records_approval_status') not in existing_indexes:
        op.create_index(op.f('ix_crm_records_approval_status'), 'crm_records', ['approval_status'], unique=False)

    if 'pipeline_stage' not in existing_cols:
        op.add_column(
            'crm_records',
            sa.Column('pipeline_stage', sa.String(length=50), server_default='New', nullable=False)
        )
    if op.f('ix_crm_records_pipeline_stage') not in existing_indexes:
        op.create_index(op.f('ix_crm_records_pipeline_stage'), 'crm_records', ['pipeline_stage'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'crm_records' not in inspector.get_table_names():
        return

    existing_cols = {c['name'] for c in inspector.get_columns('crm_records')}
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('crm_records')}

    if op.f('ix_crm_records_pipeline_stage') in existing_indexes:
        op.drop_index(op.f('ix_crm_records_pipeline_stage'), table_name='crm_records')
    if 'pipeline_stage' in existing_cols:
        op.drop_column('crm_records', 'pipeline_stage')

    if op.f('ix_crm_records_approval_status') in existing_indexes:
        op.drop_index(op.f('ix_crm_records_approval_status'), table_name='crm_records')
    if 'approval_status' in existing_cols:
        op.drop_column('crm_records', 'approval_status')
