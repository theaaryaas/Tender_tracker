"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-01 11:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value_json', sa.Text(), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_settings_id'), 'settings', ['id'], unique=False)
    op.create_index(op.f('ix_settings_key'), 'settings', ['key'], unique=True)

    op.create_table(
        'sync_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('portal_filter', sa.String(length=255), nullable=True),
        sa.Column('tenders_found', sa.Integer(), nullable=True),
        sa.Column('tenders_added', sa.Integer(), nullable=True),
        sa.Column('tenders_updated', sa.Integer(), nullable=True),
        sa.Column('error_count', sa.Integer(), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sync_logs_id'), 'sync_logs', ['id'], unique=False)

    op.create_table(
        'tenders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tender_id', sa.String(length=120), nullable=False),
        sa.Column('reference', sa.String(length=120), nullable=True),
        sa.Column('portal', sa.String(length=100), nullable=False),
        sa.Column('site_key', sa.String(length=50), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('organisation', sa.String(length=255), nullable=True),
        sa.Column('published_date', sa.String(length=60), nullable=True),
        sa.Column('closing_date', sa.String(length=60), nullable=True),
        sa.Column('opening_date', sa.String(length=60), nullable=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('doc_url', sa.Text(), nullable=True),
        sa.Column('estimated_value', sa.String(length=100), nullable=True),
        sa.Column('emd_amount', sa.String(length=100), nullable=True),
        sa.Column('emd_exemption', sa.String(length=100), nullable=True),
        sa.Column('epbg_required', sa.String(length=100), nullable=True),
        sa.Column('turnover_required', sa.String(length=100), nullable=True),
        sa.Column('bidder_turnover', sa.String(length=120), nullable=True),
        sa.Column('oem_turnover', sa.String(length=120), nullable=True),
        sa.Column('experience_required', sa.Text(), nullable=True),
        sa.Column('experience_years', sa.String(length=120), nullable=True),
        sa.Column('mse_relaxation', sa.String(length=120), nullable=True),
        sa.Column('startup_relaxation', sa.String(length=120), nullable=True),
        sa.Column('scope_summary', sa.Text(), nullable=True),
        sa.Column('extracted_pdf_text', sa.Text(), nullable=True),
        sa.Column('eligibility_assessment', sa.String(length=100), nullable=True),
        sa.Column('si_partner_route', sa.String(length=100), nullable=True),
        sa.Column('matched_keywords', sa.String(length=255), nullable=True),
        sa.Column('assessment_notes', sa.Text(), nullable=True),
        sa.Column('fit_score', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=True),
        sa.Column('user_notes', sa.Text(), nullable=True),
        sa.Column('assigned_to', sa.String(length=100), nullable=True),
        sa.Column('is_starred', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenders_closing_date'), 'tenders', ['closing_date'], unique=False)
    op.create_index(op.f('ix_tenders_eligibility_assessment'), 'tenders', ['eligibility_assessment'], unique=False)
    op.create_index(op.f('ix_tenders_id'), 'tenders', ['id'], unique=False)
    op.create_index(op.f('ix_tenders_organisation'), 'tenders', ['organisation'], unique=False)
    op.create_index(op.f('ix_tenders_portal'), 'tenders', ['portal'], unique=False)
    op.create_index(op.f('ix_tenders_priority'), 'tenders', ['priority'], unique=False)
    op.create_index(op.f('ix_tenders_site_key'), 'tenders', ['site_key'], unique=False)
    op.create_index(op.f('ix_tenders_status'), 'tenders', ['status'], unique=False)
    op.create_index(op.f('ix_tenders_tender_id'), 'tenders', ['tender_id'], unique=True)


def downgrade() -> None:
    op.drop_table('tenders')
    op.drop_table('sync_logs')
    op.drop_table('settings')

