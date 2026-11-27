"""add bidding status tender end date and linkedin to crm

Revision ID: 0006_add_crm_bidding_fields
Revises: 0005_add_docs_deep_analysis
Create Date: 2026-11-27 16:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006_add_crm_bidding_fields'
down_revision: Union[str, None] = '0005_add_docs_deep_analysis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('crm_records')]
    
    if 'bidding_status' not in existing_cols:
        op.add_column('crm_records', sa.Column('bidding_status', sa.String(length=30), server_default='Reviewing', nullable=False))
        op.create_index(op.f('ix_crm_records_bidding_status'), 'crm_records', ['bidding_status'], unique=False)
    if 'tender_end_date' not in existing_cols:
        op.add_column('crm_records', sa.Column('tender_end_date', sa.String(length=60), nullable=True))
        op.create_index(op.f('ix_crm_records_tender_end_date'), 'crm_records', ['tender_end_date'], unique=False)
    if 'linkedin_url' not in existing_cols:
        op.add_column('crm_records', sa.Column('linkedin_url', sa.String(length=255), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('crm_records')]
    
    if 'linkedin_url' in existing_cols:
        op.drop_column('crm_records', 'linkedin_url')
    if 'tender_end_date' in existing_cols:
        op.drop_index(op.f('ix_crm_records_tender_end_date'), table_name='crm_records')
        op.drop_column('crm_records', 'tender_end_date')
    if 'bidding_status' in existing_cols:
        op.drop_index(op.f('ix_crm_records_bidding_status'), table_name='crm_records')
        op.drop_column('crm_records', 'bidding_status')
