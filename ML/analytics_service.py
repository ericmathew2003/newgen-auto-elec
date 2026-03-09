# Advanced Analytics Service for Cash Flow Prediction
# Customer/Supplier Analysis, Anomaly Detection, Alert History

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class CashFlowAnalytics:
    """Advanced analytics for cash flow prediction"""
    
    def __init__(self):
        self.alert_history = []
    
    def analyze_customers(self, conn, days_back: int = 90) -> Dict:
        """Analyze top customers by cash inflow"""
        cursor = conn.cursor()
        
        start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        query = """
            SELECT 
                p.partyid,
                p.partyname,
                COUNT(DISTINCT m.inv_master_id) as invoice_count,
                SUM(m.tot_amount) as total_inflow,
                AVG(m.tot_amount) as avg_invoice_value,
                MAX(m.inv_date) as last_transaction_date,
                MIN(m.inv_date) as first_transaction_date
            FROM public.trn_invoice_master m
            JOIN public.tblmasparty p ON m.party_id = p.partyid
            WHERE m.inv_date >= %s
            AND m.is_deleted = false
            AND m.is_posted = true
            GROUP BY p.partyid, p.partyname
            ORDER BY total_inflow DESC
            LIMIT 10
        """
        
        cursor.execute(query, (start_date,))
        results = cursor.fetchall()
        
        customers = []
        for row in results:
            customers.append({
                'party_id': row[0],
                'name': row[1],
                'invoice_count': row[2],
                'total_inflow': float(row[3] or 0),
                'avg_invoice_value': float(row[4] or 0),
                'last_transaction': row[5].strftime('%Y-%m-%d') if row[5] else None,
                'first_transaction': row[6].strftime('%Y-%m-%d') if row[6] else None
            })
        
        cursor.close()
        return {
            'top_customers': customers,
            'period_days': days_back,
            'total_customers': len(customers)
        }
    
    def analyze_suppliers(self, conn, days_back: int = 90) -> Dict:
        """Analyze top suppliers by cash outflow"""
        cursor = conn.cursor()
        
        start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        query = """
            SELECT 
                p.partyid,
                p.partyname,
                COUNT(DISTINCT pur.tranid) as purchase_count,
                SUM(pur.invamt + COALESCE(pur.cgst,0) + COALESCE(pur.sgst,0) + COALESCE(pur.igst,0)) as total_outflow,
                AVG(pur.invamt + COALESCE(pur.cgst,0) + COALESCE(pur.sgst,0) + COALESCE(pur.igst,0)) as avg_purchase_value,
                MAX(pur.trdate) as last_transaction_date,
                MIN(pur.trdate) as first_transaction_date
            FROM public.tbltrnpurchase pur
            JOIN public.tblmasparty p ON pur.partyid = p.partyid
            WHERE pur.trdate >= %s
            AND (pur.is_cancelled = false OR pur.is_cancelled IS NULL)
            AND pur.accounts_posted = true
            GROUP BY p.partyid, p.partyname
            ORDER BY total_outflow DESC
            LIMIT 10
        """
        
        cursor.execute(query, (start_date,))
        results = cursor.fetchall()
        
        suppliers = []
        for row in results:
            suppliers.append({
                'party_id': row[0],
                'name': row[1],
                'purchase_count': row[2],
                'total_outflow': float(row[3] or 0),
                'avg_purchase_value': float(row[4] or 0),
                'last_transaction': row[5].strftime('%Y-%m-%d') if row[5] else None,
                'first_transaction': row[6].strftime('%Y-%m-%d') if row[6] else None
            })
        
        cursor.close()
        return {
            'top_suppliers': suppliers,
            'period_days': days_back,
            'total_suppliers': len(suppliers)
        }
    
    def analyze_payment_patterns(self, conn, days_back: int = 90) -> Dict:
        """Analyze customer payment behavior"""
        cursor = conn.cursor()
        
        start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        # Get invoice and payment data - tran_date is already a DATE type
        query = """
            SELECT 
                p.partyid,
                p.partyname,
                COUNT(DISTINCT inv.tran_id) as total_invoices,
                SUM(inv.balance_amount) as outstanding_balance,
                AVG(CURRENT_DATE - inv.tran_date) as avg_days_outstanding
            FROM public.acc_trn_invoice inv
            JOIN public.tblmasparty p ON inv.party_id = p.partyid
            WHERE inv.tran_date >= %s::date
            AND inv.tran_type = 'SAL'
            AND inv.balance_amount > 0
            GROUP BY p.partyid, p.partyname
            ORDER BY outstanding_balance DESC
            LIMIT 10
        """
        
        cursor.execute(query, (start_date,))
        results = cursor.fetchall()
        
        late_payers = []
        for row in results:
            risk_level = 'HIGH' if row[4] > 60 else 'MEDIUM' if row[4] > 30 else 'LOW'
            late_payers.append({
                'party_id': row[0],
                'name': row[1],
                'invoice_count': row[2],
                'outstanding_balance': float(row[3] or 0),
                'avg_days_outstanding': int(row[4] or 0),
                'risk_level': risk_level
            })
        
        cursor.close()
        return {
            'late_payers': late_payers,
            'period_days': days_back
        }
    
    def detect_anomalies(self, cash_flow_data: pd.DataFrame, conn=None) -> List[Dict]:
        """
        Intelligent Anomaly Detection with Business Context
        
        Uses multi-layered approach:
        1. Statistical analysis (Z-score)
        2. Account type classification
        3. Transaction pattern recognition
        4. Business logic rules
        """
        if len(cash_flow_data) < 7:
            return []
        
        anomalies = []
        
        # Calculate statistics
        mean_inflow = cash_flow_data['inflow'].mean()
        std_inflow = cash_flow_data['inflow'].std()
        mean_outflow = cash_flow_data['outflow'].mean()
        std_outflow = cash_flow_data['outflow'].std()
        
        # Define legitimate transaction categories (NOT anomalies)
        LEGITIMATE_CATEGORIES = {
            'CAPITAL': ['capital', 'proprietor', 'owner', 'equity', 'investment'],
            'LOAN': ['loan', 'borrowing', 'bank loan', 'term loan', 'overdraft'],
            'ASSET_PURCHASE': ['fixed asset', 'machinery', 'equipment', 'vehicle', 'property'],
            'ASSET_SALE': ['asset sale', 'disposal', 'scrap sale'],
            'LOAN_REPAYMENT': ['loan repayment', 'emi', 'principal payment'],
            'TAX_PAYMENT': ['income tax', 'gst payment', 'tds', 'advance tax'],
            'DIVIDEND': ['dividend', 'profit distribution'],
            'REFUND': ['refund', 'return', 'credit note']
        }
        
        # Detect anomalies with context
        for idx, row in cash_flow_data.iterrows():
            anomaly_date = row['date'].strftime('%Y-%m-%d')
            
            # Get detailed journal information
            journal_info = None
            if conn:
                journal_info = self._get_journal_context(conn, anomaly_date)
            
            # Check inflow anomalies
            if row['inflow'] > mean_inflow + (2 * std_inflow) and row['inflow'] > 0:
                # Calculate Z-score for severity assessment
                z_score = (row['inflow'] - mean_inflow) / std_inflow if std_inflow > 0 else 0
                
                # Check if this is a legitimate transaction
                is_legitimate, category, reason = self._is_legitimate_transaction(
                    journal_info, 'inflow', row['inflow'], LEGITIMATE_CATEGORIES
                )
                
                if not is_legitimate:
                    anomaly = {
                        'date': anomaly_date,
                        'type': 'UNUSUAL_INFLOW',
                        'amount': float(row['inflow']),
                        'z_score': round(z_score, 2),
                        'expected_range': f"₹{mean_inflow - std_inflow:,.0f} - ₹{mean_inflow + std_inflow:,.0f}",
                        'severity': self._calculate_severity(z_score, 'inflow'),
                        'description': f'Unusually high cash inflow of ₹{row["inflow"]:,.0f}',
                        'requires_review': True
                    }
                    
                    if journal_info:
                        anomaly.update(journal_info)
                        anomaly['analysis'] = self._analyze_transaction(journal_info, 'inflow', row['inflow'])
                    
                    anomalies.append(anomaly)
                else:
                    # Log as legitimate but notable transaction
                    logger.info(f"Legitimate {category} transaction on {anomaly_date}: ₹{row['inflow']:,.0f} - {reason}")
            
            # Check outflow anomalies
            if row['outflow'] > mean_outflow + (2 * std_outflow) and row['outflow'] > 0:
                z_score = (row['outflow'] - mean_outflow) / std_outflow if std_outflow > 0 else 0
                
                is_legitimate, category, reason = self._is_legitimate_transaction(
                    journal_info, 'outflow', row['outflow'], LEGITIMATE_CATEGORIES
                )
                
                if not is_legitimate:
                    anomaly = {
                        'date': anomaly_date,
                        'type': 'UNUSUAL_OUTFLOW',
                        'amount': float(row['outflow']),
                        'z_score': round(z_score, 2),
                        'expected_range': f"₹{mean_outflow - std_outflow:,.0f} - ₹{mean_outflow + std_outflow:,.0f}",
                        'severity': self._calculate_severity(z_score, 'outflow'),
                        'description': f'Unusually high cash outflow of ₹{row["outflow"]:,.0f}',
                        'requires_review': True
                    }
                    
                    if journal_info:
                        anomaly.update(journal_info)
                        anomaly['analysis'] = self._analyze_transaction(journal_info, 'outflow', row['outflow'])
                    
                    anomalies.append(anomaly)
            
            # Check for suspicious patterns (potential fraud indicators)
            if row['net_flow'] < -abs(mean_inflow) and row['outflow'] > mean_outflow + (3 * std_outflow):
                anomaly = {
                    'date': anomaly_date,
                    'type': 'SUSPICIOUS_PATTERN',
                    'amount': float(row['net_flow']),
                    'outflow_amount': float(row['outflow']),
                    'expected_range': 'Positive or small negative',
                    'severity': 'CRITICAL',
                    'description': f'Suspicious: Large outflow (₹{row["outflow"]:,.0f}) with minimal inflow',
                    'requires_review': True,
                    'fraud_indicators': self._check_fraud_indicators(journal_info, row)
                }
                
                if journal_info:
                    anomaly.update(journal_info)
                
                anomalies.append(anomaly)
        
        return anomalies[:15]  # Return top 15 anomalies
    
    def _get_journal_context(self, conn, date: str) -> Dict:
        """Get detailed journal context for anomaly analysis"""
        try:
            cursor = conn.cursor()
            
            # First, try to get the journal that affects cash/bank accounts
            cursor.execute("""
                SELECT 
                    jm.journal_serial,
                    jm.source_document_type,
                    jm.source_document_ref,
                    jm.narration,
                    STRING_AGG(DISTINCT coa.account_name, ', ' ORDER BY coa.account_name) as accounts,
                    STRING_AGG(DISTINCT coa.account_nature, ', ' ORDER BY coa.account_nature) as account_natures,
                    MAX(jd.debit_amount) as max_debit,
                    MAX(jd.credit_amount) as max_credit,
                    COUNT(DISTINCT jd.journal_detail_id) as line_count,
                    jm.journal_mas_id
                FROM public.acc_journal_master jm
                JOIN public.acc_journal_detail jd ON jm.journal_mas_id = jd.journal_mas_id
                JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
                WHERE jm.journal_date = %s::date
                GROUP BY jm.journal_mas_id, jm.journal_serial, jm.source_document_type, jm.source_document_ref, jm.narration
                HAVING COUNT(DISTINCT CASE 
                    WHEN coa.account_nature IN ('CASH_HAND', 'BANK_ACC', 'CASH', 'BANK')
                         OR UPPER(coa.account_name) LIKE '%%CASH%%'
                         OR UPPER(coa.account_name) LIKE '%%BANK%%'
                    THEN jd.journal_detail_id 
                END) > 0
                ORDER BY jm.journal_mas_id DESC
                LIMIT 1
            """, (date,))
            result = cursor.fetchone()
            
            if result:
                journal_data = {
                    'journal_serial': result[0],
                    'document_type': result[1] or 'Journal',
                    'document_ref': result[2],
                    'narration': result[3],
                    'accounts': result[4],
                    'account_natures': result[5],
                    'max_debit': float(result[6] or 0),
                    'max_credit': float(result[7] or 0),
                    'line_count': int(result[8] or 0)
                }
                
                logger.info(f"Found journal context for {date}: {journal_data['journal_serial']}")
                cursor.close()
                return journal_data
            else:
                logger.warning(f"No journal found for date {date}")
                cursor.close()
                return None
                
        except Exception as e:
            logger.error(f"Error fetching journal context for {date}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                cursor.close()
            except:
                pass
        
        return None
    
    def _is_legitimate_transaction(self, journal_info: Dict, flow_type: str, 
                                   amount: float, categories: Dict) -> Tuple[bool, str, str]:
        """
        Determine if a transaction is legitimate based on business context
        Returns: (is_legitimate, category, reason)
        """
        if not journal_info:
            return (False, 'UNKNOWN', 'Insufficient information')
        
        narration = (journal_info.get('narration') or '').lower()
        doc_ref = (journal_info.get('document_ref') or '').lower()
        account_natures = (journal_info.get('account_natures') or '').lower()
        accounts = (journal_info.get('accounts') or '').lower()
        
        # Check each category
        for category, keywords in categories.items():
            for keyword in keywords:
                if (keyword in narration or keyword in doc_ref or 
                    keyword in account_natures or keyword in accounts):
                    
                    # Validate based on flow type and category
                    if flow_type == 'inflow':
                        if category in ['CAPITAL', 'LOAN', 'ASSET_SALE', 'REFUND']:
                            return (True, category, f'{category} transaction: {keyword} found')
                    else:  # outflow
                        if category in ['ASSET_PURCHASE', 'LOAN_REPAYMENT', 'TAX_PAYMENT', 'DIVIDEND']:
                            return (True, category, f'{category} transaction: {keyword} found')
        
        # Check for round numbers (often legitimate business transactions)
        if amount % 100000 == 0 and amount >= 100000:
            return (True, 'ROUND_AMOUNT', f'Round amount (₹{amount:,.0f}) suggests planned transaction')
        
        return (False, 'UNKNOWN', 'Does not match known legitimate patterns')
    
    def _calculate_severity(self, z_score: float, flow_type: str) -> str:
        """Calculate severity based on Z-score"""
        abs_z = abs(z_score)
        
        if abs_z >= 4:
            return 'CRITICAL'
        elif abs_z >= 3:
            return 'HIGH'
        elif abs_z >= 2:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _analyze_transaction(self, journal_info: Dict, flow_type: str, amount: float) -> Dict:
        """Provide detailed analysis of the transaction"""
        analysis = {
            'transaction_type': flow_type,
            'amount': amount,
            'indicators': []
        }
        
        narration = (journal_info.get('narration') or '').lower()
        line_count = journal_info.get('line_count', 0)
        
        # Analyze transaction characteristics
        if line_count == 2:
            analysis['indicators'].append('Simple two-line entry (typical for basic transactions)')
        elif line_count > 5:
            analysis['indicators'].append(f'Complex entry with {line_count} lines (review for accuracy)')
        
        # Check for vague descriptions
        vague_terms = ['misc', 'sundry', 'various', 'others', 'general']
        if any(term in narration for term in vague_terms):
            analysis['indicators'].append('⚠️ Vague description - requires detailed documentation')
        
        # Check for proper documentation
        if not journal_info.get('document_ref'):
            analysis['indicators'].append('⚠️ No document reference - add supporting documents')
        
        # Suggest actions
        analysis['recommended_actions'] = []
        if amount > 100000:
            analysis['recommended_actions'].append('Verify with bank statement')
            analysis['recommended_actions'].append('Ensure proper authorization')
        
        if 'cash' in (journal_info.get('accounts') or '').lower() and amount > 50000:
            analysis['recommended_actions'].append('⚠️ Large cash transaction - verify compliance with cash limits')
        
        return analysis
    
    def _check_fraud_indicators(self, journal_info: Dict, row: pd.Series) -> List[str]:
        """Check for potential fraud indicators"""
        indicators = []
        
        if not journal_info:
            return indicators
        
        narration = (journal_info.get('narration') or '').lower()
        
        # Red flags
        if 'urgent' in narration or 'immediate' in narration:
            indicators.append('Urgency language used')
        
        if journal_info.get('line_count', 0) > 10:
            indicators.append('Unusually complex entry')
        
        if not journal_info.get('document_ref'):
            indicators.append('Missing document reference')
        
        # Weekend/holiday transactions (would need date checking)
        # Unusual timing patterns
        
        return indicators
    
    def save_alert(self, alert: Dict):
        """Save alert to history"""
        alert['timestamp'] = datetime.now().isoformat()
        self.alert_history.append(alert)
        
        # Keep only last 100 alerts
        if len(self.alert_history) > 100:
            self.alert_history = self.alert_history[-100:]
    
    def get_alert_history(self, limit: int = 50) -> List[Dict]:
        """Get alert history"""
        return self.alert_history[-limit:]
    
    def clear_old_alerts(self, days: int = 30):
        """Clear alerts older than specified days"""
        cutoff_date = datetime.now() - timedelta(days=days)
        self.alert_history = [
            alert for alert in self.alert_history
            if datetime.fromisoformat(alert['timestamp']) > cutoff_date
        ]

# Global analytics instance
analytics = CashFlowAnalytics()
