"""add rbac crm and audit

Revision ID: 0004_add_rbac_crm_and_audit
Revises: 0003_add_users_table
Create Date: 2026-11-23 14:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0004_add_rbac_crm_and_audit'
down_revision: Union[str, None] = '0003_add_users_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Update users table with RBAC columns
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_user_cols = [c['name'] for c in inspector.get_columns('users')]
    
    if 'role' not in existing_user_cols:
        op.add_column('users', sa.Column('role', sa.String(length=20), server_default='executive', nullable=False))
        op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    if 'created_by_id' not in existing_user_cols:
        op.add_column('users', sa.Column('created_by_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_users_created_by', 'users', 'users', ['created_by_id'], ['id'], ondelete='SET NULL')
    if 'permissions' not in existing_user_cols:
        op.add_column('users', sa.Column('permissions', sa.JSON(), server_default='[]', nullable=False))
    if 'is_active' not in existing_user_cols:
        op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))

    # 2. Update tenders table with claiming columns
    existing_tender_cols = [c['name'] for c in inspector.get_columns('tenders')]
    if 'assigned_to_id' not in existing_tender_cols:
        op.add_column('tenders', sa.Column('assigned_to_id', sa.Integer(), nullable=True))
        op.create_index(op.f('ix_tenders_assigned_to_id'), 'tenders', ['assigned_to_id'], unique=False)
    if 'claimed_at' not in existing_tender_cols:
        op.add_column('tenders', sa.Column('claimed_at', sa.DateTime(), nullable=True))
    if 'is_claimed' not in existing_tender_cols:
        op.add_column('tenders', sa.Column('is_claimed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
        op.create_index(op.f('ix_tenders_is_claimed'), 'tenders', ['is_claimed'], unique=False)

    # 3. Create crm_records table
    existing_tables = inspector.get_table_names()
    if 'crm_records' not in existing_tables:
        op.create_table(
            'crm_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tender_id', sa.Integer(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('entered_date', sa.Date(), server_default=sa.func.current_date(), nullable=False),
            sa.Column('lead_status', sa.String(length=20), server_default='Warm', nullable=False),
            sa.Column('company_name', sa.String(length=255), nullable=False),
            sa.Column('client_name', sa.String(length=150), nullable=True),
            sa.Column('client_designation', sa.String(length=100), nullable=True),
            sa.Column('client_phone', sa.String(length=50), nullable=True),
            sa.Column('client_email', sa.String(length=150), nullable=True),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('visibility', sa.String(length=20), server_default='all', nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['tender_id'], ['tenders.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_crm_records_id'), 'crm_records', ['id'], unique=False)
        op.create_index(op.f('ix_crm_records_tender_id'), 'crm_records', ['tender_id'], unique=False)
        op.create_index(op.f('ix_crm_records_user_id'), 'crm_records', ['user_id'], unique=False)
        op.create_index(op.f('ix_crm_records_entered_date'), 'crm_records', ['entered_date'], unique=False)
        op.create_index(op.f('ix_crm_records_lead_status'), 'crm_records', ['lead_status'], unique=False)
        op.create_index(op.f('ix_crm_records_company_name'), 'crm_records', ['company_name'], unique=False)
        op.create_index(op.f('ix_crm_records_visibility'), 'crm_records', ['visibility'], unique=False)

    # 4. Create audit_logs table
    if 'audit_logs' not in existing_tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('user_name', sa.String(length=100), nullable=False),
            sa.Column('user_role', sa.String(length=20), nullable=False),
            sa.Column('action', sa.String(length=50), nullable=False),
            sa.Column('entity_type', sa.String(length=30), nullable=False),
            sa.Column('entity_id', sa.String(length=50), nullable=False),
            sa.Column('old_values', sa.JSON(), nullable=True),
            sa.Column('new_values', sa.JSON(), nullable=True),
            sa.Column('ip_address', sa.String(length=50), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
        op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
        op.create_index(op.f('ix_audit_logs_user_role'), 'audit_logs', ['user_role'], unique=False)
        op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
        op.create_index(op.f('ix_audit_logs_entity_type'), 'audit_logs', ['entity_type'], unique=False)
        op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)
        op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)

def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('crm_records')
    op.drop_column('tenders', 'is_claimed')
    op.drop_column('tenders', 'claimed_at')
    op.drop_column('tenders', 'assigned_to_id')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'permissions')
    op.drop_column('users', 'created_by_id')
    op.drop_column('users', 'role')

