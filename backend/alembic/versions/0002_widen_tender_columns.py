"""widen tender columns

Revision ID: 0002_widen_tender_columns
Revises: 0001_initial_schema
Create Date: 2026-11-02 10:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0002_widen_tender_columns'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('tenders', 'si_partner_route',
               existing_type=sa.String(length=100),
               type_=sa.Text(),
               existing_nullable=True)
    op.alter_column('tenders', 'eligibility_assessment',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'estimated_value',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'emd_amount',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'emd_exemption',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'epbg_required',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'turnover_required',
               existing_type=sa.String(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'bidder_turnover',
               existing_type=sa.String(length=120),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'oem_turnover',
               existing_type=sa.String(length=120),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'experience_years',
               existing_type=sa.String(length=120),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'mse_relaxation',
               existing_type=sa.String(length=120),
               type_=sa.String(length=255),
               existing_nullable=True)
    op.alter_column('tenders', 'startup_relaxation',
               existing_type=sa.String(length=120),
               type_=sa.String(length=255),
               existing_nullable=True)


def downgrade() -> None:
    pass

