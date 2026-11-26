"""add documents and deep analysis columns to tenders

Revision ID: 0005_add_docs_deep_analysis
Revises: 0004_add_rbac_crm_and_audit
Create Date: 2026-11-26 23:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005_add_docs_deep_analysis'
down_revision: Union[str, None] = '0004_add_rbac_crm_and_audit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('tenders')]
    
    if 'documents' not in existing_cols:
        op.add_column('tenders', sa.Column('documents', sa.JSON(), nullable=True))
    if 'deep_analysis' not in existing_cols:
        op.add_column('tenders', sa.Column('deep_analysis', sa.JSON(), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('tenders')]
    
    if 'deep_analysis' in existing_cols:
        op.drop_column('tenders', 'deep_analysis')
    if 'documents' in existing_cols:
        op.drop_column('tenders', 'documents')
