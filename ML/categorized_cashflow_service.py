# Enhanced Cash Flow Service with Transaction Categorization
# Categorizes transactions by account nature (Revenue, Expense, Asset, Liability, etc.)

import pandas as pd
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

def get_account_category(group_name: str, group_type: str, account_nature: str = None) -> str:
    """
    Determine transaction category based on account group and nature
    Returns: REVENUE, EXPENSE, ASSET, LIABILITY, EQUITY, TAX, OTHER
    """
    # First check account_nature if available
    if account_nature:
        nature_upper = account_nature.upper()
        if 'SALES' in nature_upper or 'REV' in nature_upper:
            return 'REVENUE'
        elif 'COGS' in nature_upper or 'EXPENSE' in nature_upper:
            return 'EXPENSE'
        elif 'GST' in nature_upper or 'CGST' in nature_upper or 'SGST' in nature_upper or 'TAX' in nature_upper:
            return 'TAX'
        elif 'AR_CONTROL' in nature_upper:
            return 'CUSTOMER_PAYMENT'
        elif 'AP_CONTROL' in nature_upper:
            return 'SUPPLIER_PAYMENT'
    
    # Fall back to group analysis
    group_upper = group_name.upper() if group_name else ''
    
    # Check group type
    if group_type == 'PL':  # Profit & Loss
        if 'INCOME' in group_upper or 'REVENUE' in group_upper:
            return 'REVENUE'
        elif 'EXPENSE' in group_upper or 'COST' in group_upper:
            return 'EXPENSE'
    elif group_type == 'BS':  # Balance Sheet
        if 'ASSET' in group_upper:
            return 'ASSET'
        elif 'LIABILITY' in group_upper or 'PAYABLE' in group_upper:
            return 'LIABILITY'
        elif 'EQUITY' in group_upper or 'CAPITAL' in group_upper:
            return 'EQUITY'
        elif 'RECEIVABLE' in group_upper:
            return 'CUSTOMER_PAYMENT'
    
    return 'OTHER'


def fetch_categorized_cash_flow(conn, days_back: int = 90) -> pd.DataFrame:
    """
    Fetch cash flow data categorized by transaction type
    Returns DataFrame with columns: date, category, inflow, outflow
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    query = """
        WITH cash_transactions AS (
            SELECT 
                jm.journal_date,
                jm.source_document_type,
                jm.journal_mas_id,
                jd.journal_detail_id,
                coa.account_nature as cash_nature,
                jd.debit_amount as cash_inflow,
                jd.credit_amount as cash_outflow
            FROM public.acc_journal_master jm
            JOIN public.acc_journal_detail jd ON jm.journal_mas_id = jd.journal_mas_id
            JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
            WHERE jm.journal_date >= %s::date
            AND (coa.account_nature IN ('CASH_HAND', 'BANK_ACC') 
                 OR UPPER(coa.account_name) LIKE '%%CASH%%'
                 OR UPPER(coa.account_name) LIKE '%%BANK%%')
        ),
        contra_accounts AS (
            SELECT 
                ct.journal_date,
                ct.source_document_type,
                ct.cash_inflow,
                ct.cash_outflow,
                coa2.account_name as contra_account,
                coa2.account_nature as contra_nature,
                g.group_name as contra_group,
                g.group_type as contra_group_type
            FROM cash_transactions ct
            JOIN public.acc_journal_detail jd2 ON ct.journal_mas_id = jd2.journal_mas_id
            JOIN public.acc_mas_coa coa2 ON jd2.account_id = coa2.account_id
            JOIN public.acc_mas_group g ON coa2.group_id = g.group_id
            WHERE jd2.journal_detail_id != ct.journal_detail_id
            AND coa2.account_nature NOT IN ('CASH_HAND', 'BANK_ACC')
            AND UPPER(coa2.account_name) NOT LIKE '%%CASH%%'
            AND UPPER(coa2.account_name) NOT LIKE '%%BANK%%'
        )
        SELECT 
            journal_date as date,
            source_document_type,
            contra_account,
            contra_nature,
            contra_group,
            contra_group_type,
            SUM(cash_inflow) as inflow,
            SUM(cash_outflow) as outflow
        FROM contra_accounts
        GROUP BY journal_date, source_document_type, contra_account, contra_nature, contra_group, contra_group_type
        ORDER BY journal_date
    """
    
    cursor.execute(query, (start_date,))
    results = cursor.fetchall()
    
    # Process and categorize
    df_data = []
    for row in results:
        category = get_account_category(
            row['contra_group'],
            row['contra_group_type'],
            row['contra_nature']
        )
        
        df_data.append({
            'date': pd.to_datetime(row['date']),
            'category': category,
            'account_name': row['contra_account'],
            'inflow': float(row['inflow'] or 0),
            'outflow': float(row['outflow'] or 0),
            'net_flow': float(row['inflow'] or 0) - float(row['outflow'] or 0)
        })
    
    df = pd.DataFrame(df_data)
    cursor.close()
    
    logger.info(f"Fetched {len(df)} categorized cash flow records")
    return df


def get_category_summary(conn, days_back: int = 90) -> dict:
    """Get summary of cash flows by category"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    query = """
        WITH cash_transactions AS (
            SELECT 
                jm.journal_date,
                jm.source_document_type,
                jm.journal_mas_id,
                jd.journal_detail_id,
                jd.debit_amount as cash_inflow,
                jd.credit_amount as cash_outflow
            FROM public.acc_journal_master jm
            JOIN public.acc_journal_detail jd ON jm.journal_mas_id = jd.journal_mas_id
            JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
            WHERE jm.journal_date >= %s::date
            AND (coa.account_nature IN ('CASH_HAND', 'BANK_ACC') 
                 OR UPPER(coa.account_name) LIKE '%%CASH%%'
                 OR UPPER(coa.account_name) LIKE '%%BANK%%')
        ),
        contra_accounts AS (
            SELECT 
                ct.journal_date,
                ct.source_document_type,
                ct.cash_inflow,
                ct.cash_outflow,
                coa2.account_name as contra_account,
                coa2.account_nature as contra_nature,
                g.group_name as contra_group,
                g.group_type as contra_group_type
            FROM cash_transactions ct
            JOIN public.acc_journal_detail jd2 ON ct.journal_mas_id = jd2.journal_mas_id
            JOIN public.acc_mas_coa coa2 ON jd2.account_id = coa2.account_id
            JOIN public.acc_mas_group g ON coa2.group_id = g.group_id
            WHERE jd2.journal_detail_id != ct.journal_detail_id
            AND coa2.account_nature NOT IN ('CASH_HAND', 'BANK_ACC')
            AND UPPER(coa2.account_name) NOT LIKE '%%CASH%%'
            AND UPPER(coa2.account_name) NOT LIKE '%%BANK%%'
        )
        SELECT 
            contra_account,
            contra_nature,
            contra_group,
            contra_group_type,
            COUNT(*) as transaction_count,
            SUM(cash_inflow) as total_inflow,
            SUM(cash_outflow) as total_outflow
        FROM contra_accounts
        GROUP BY contra_account, contra_nature, contra_group, contra_group_type
        ORDER BY ABS(SUM(cash_inflow) - SUM(cash_outflow)) DESC
    """
    
    cursor.execute(query, (start_date,))
    results = cursor.fetchall()
    
    # Group by category
    category_summary = {}
    for row in results:
        category = get_account_category(
            row['contra_group'],
            row['contra_group_type'],
            row['contra_nature']
        )
        
        if category not in category_summary:
            category_summary[category] = {
                'category': category,
                'transaction_count': 0,
                'total_inflow': 0,
                'total_outflow': 0,
                'accounts': []
            }
        
        category_summary[category]['transaction_count'] += row['transaction_count']
        category_summary[category]['total_inflow'] += float(row['total_inflow'] or 0)
        category_summary[category]['total_outflow'] += float(row['total_outflow'] or 0)
        category_summary[category]['accounts'].append({
            'name': row['contra_account'],
            'inflow': float(row['total_inflow'] or 0),
            'outflow': float(row['total_outflow'] or 0)
        })
    
    # Calculate net flow
    categories = []
    for cat_data in category_summary.values():
        cat_data['net_flow'] = cat_data['total_inflow'] - cat_data['total_outflow']
        categories.append(cat_data)
    
    # Sort by absolute net flow
    categories.sort(key=lambda x: abs(x['net_flow']), reverse=True)
    
    cursor.close()
    return {'categories': categories, 'period_days': days_back}


# Category mapping for better display names
CATEGORY_DISPLAY_NAMES = {
    'REVENUE': '💰 Sales & Revenue',
    'EXPENSE': '💸 Operating Expenses',
    'CUSTOMER_PAYMENT': '👥 Customer Payments (AR)',
    'SUPPLIER_PAYMENT': '🏭 Supplier Payments (AP)',
    'TAX': '📋 Tax Payments (GST)',
    'ASSET': '🏢 Asset Transactions',
    'LIABILITY': '📊 Liability Transactions',
    'EQUITY': '💼 Equity/Capital',
    'OTHER': '📦 Other Transactions'
}

def get_category_display_name(category: str) -> str:
    """Get user-friendly display name for category"""
    return CATEGORY_DISPLAY_NAMES.get(category, category.replace('_', ' ').title())
