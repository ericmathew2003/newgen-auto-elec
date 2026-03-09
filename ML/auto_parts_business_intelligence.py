# Auto Parts Shop Business Intelligence
# Industry-specific recommendations and alerts for auto spare parts retail business

import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class AutoPartsBusinessIntelligence:
    """Business intelligence specifically for auto parts retail shops"""
    
    def __init__(self):
        self.industry = "Auto Parts Retail"
        
    def analyze_business_health(self, conn, predictions: List[Dict]) -> Dict:
        """Comprehensive business health analysis for auto parts shop"""
        
        recommendations = []
        alerts = []
        insights = []
        
        # 1. Inventory Analysis
        inventory_insights = self._analyze_inventory(conn)
        recommendations.extend(inventory_insights['recommendations'])
        alerts.extend(inventory_insights['alerts'])
        insights.extend(inventory_insights['insights'])
        
        # 2. Customer Credit Analysis
        credit_insights = self._analyze_customer_credit(conn)
        recommendations.extend(credit_insights['recommendations'])
        alerts.extend(credit_insights['alerts'])
        
        # 3. Supplier Payment Analysis
        supplier_insights = self._analyze_supplier_payments(conn)
        recommendations.extend(supplier_insights['recommendations'])
        
        # 4. Cash Flow Patterns
        cashflow_insights = self._analyze_cashflow_patterns(conn, predictions)
        recommendations.extend(cashflow_insights['recommendations'])
        alerts.extend(cashflow_insights['alerts'])
        
        # 5. Profitability Analysis
        profit_insights = self._analyze_profitability(conn)
        recommendations.extend(profit_insights['recommendations'])
        insights.extend(profit_insights['insights'])
        
        return {
            'recommendations': recommendations[:10],  # Top 10
            'alerts': alerts[:5],  # Top 5
            'insights': insights,
            'industry': self.industry
        }
    
    def _analyze_inventory(self, conn) -> Dict:
        """Analyze inventory levels and turnover"""
        cursor = conn.cursor()
        recommendations = []
        alerts = []
        insights = []
        
        try:
            # Get current inventory value
            cursor.execute("""
                SELECT 
                    SUM(jd.debit_amount - jd.credit_amount) as inventory_value
                FROM public.acc_journal_detail jd
                JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
                WHERE coa.account_nature = 'STOCK_ON_HAND'
            """)
            result = cursor.fetchone()
            inventory_value = float(result[0] or 0) if result else 0
            
            # Get monthly COGS (inventory sold)
            cursor.execute("""
                SELECT 
                    SUM(jd.debit_amount) as monthly_cogs
                FROM public.acc_journal_detail jd
                JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
                JOIN public.acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
                WHERE coa.account_nature = 'COGS'
                AND jm.journal_date >= CURRENT_DATE - INTERVAL '30 days'
            """)
            result = cursor.fetchone()
            monthly_cogs = float(result[0] or 0) if result else 0
            
            # Calculate inventory turnover (months of inventory)
            if monthly_cogs > 0:
                months_of_inventory = inventory_value / monthly_cogs
                
                insights.append({
                    'metric': 'Inventory Turnover',
                    'value': f'{months_of_inventory:.1f} months',
                    'status': 'good' if months_of_inventory < 2 else 'warning' if months_of_inventory < 3 else 'critical'
                })
                
                if months_of_inventory > 3:
                    alerts.append({
                        'type': 'WARNING',
                        'title': 'High Inventory Levels',
                        'message': f'You have {months_of_inventory:.1f} months of inventory. This ties up ₹{inventory_value:,.0f} in working capital.',
                        'action': 'Review slow-moving items and consider promotions'
                    })
                    
                    recommendations.append({
                        'category': 'Inventory Management',
                        'priority': 'HIGH',
                        'recommendation': 'Reduce Excess Inventory',
                        'description': f'Current inventory: ₹{inventory_value:,.0f} ({months_of_inventory:.1f} months supply)',
                        'expected_impact': f'Free up ₹{inventory_value * 0.3:,.0f} in working capital',
                        'action_items': [
                            'Identify slow-moving auto parts (>90 days)',
                            'Offer 10-15% discount on slow-moving items',
                            'Return excess stock to suppliers if possible',
                            'Reduce purchase orders for overstocked items'
                        ]
                    })
                elif months_of_inventory < 1:
                    recommendations.append({
                        'category': 'Inventory Management',
                        'priority': 'MEDIUM',
                        'recommendation': 'Increase Inventory Levels',
                        'description': f'Only {months_of_inventory:.1f} months of inventory may cause stockouts',
                        'expected_impact': 'Prevent lost sales and customer dissatisfaction',
                        'action_items': [
                            'Identify fast-moving parts',
                            'Increase safety stock for popular items',
                            'Negotiate better terms with suppliers for bulk orders'
                        ]
                    })
        except Exception as e:
            logger.error(f"Error analyzing inventory: {e}")
        
        cursor.close()
        return {'recommendations': recommendations, 'alerts': alerts, 'insights': insights}
    
    def _analyze_customer_credit(self, conn) -> Dict:
        """Analyze customer credit and payment behavior"""
        cursor = conn.cursor()
        recommendations = []
        alerts = []
        
        try:
            # Get receivables aging
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT party_id) as customer_count,
                    SUM(balance_amount) as total_outstanding,
                    AVG(CURRENT_DATE - tran_date) as avg_days,
                    SUM(CASE WHEN CURRENT_DATE - tran_date > 60 THEN balance_amount ELSE 0 END) as overdue_60
                FROM public.acc_trn_invoice
                WHERE tran_type = 'SAL'
                AND balance_amount > 0
            """)
            result = cursor.fetchone()
            
            if result and result[1]:
                total_outstanding = float(result[1])
                avg_days = int(result[2] or 0)
                overdue_60 = float(result[3] or 0)
                
                if avg_days > 45:
                    alerts.append({
                        'type': 'CRITICAL',
                        'title': 'High Customer Credit Days',
                        'message': f'Average payment delay: {avg_days} days. ₹{total_outstanding:,.0f} outstanding',
                        'action': 'Tighten credit policy and follow up with customers'
                    })
                    
                    recommendations.append({
                        'category': 'Credit Management',
                        'priority': 'CRITICAL',
                        'recommendation': 'Improve Collection Process',
                        'description': f'₹{total_outstanding:,.0f} tied up in receivables (avg {avg_days} days)',
                        'expected_impact': f'Collect ₹{total_outstanding * 0.5:,.0f} within 15 days',
                        'action_items': [
                            'Call customers with invoices >45 days old',
                            'Offer 5% discount for immediate payment',
                            'Stop credit for customers with >60 days overdue',
                            'Implement cash-on-delivery for new customers',
                            'Send daily payment reminders via WhatsApp/SMS'
                        ]
                    })
                
                if overdue_60 > total_outstanding * 0.2:
                    recommendations.append({
                        'category': 'Bad Debt Risk',
                        'priority': 'HIGH',
                        'recommendation': 'Address Overdue Accounts',
                        'description': f'₹{overdue_60:,.0f} overdue >60 days (risk of bad debt)',
                        'expected_impact': 'Prevent write-offs and improve cash flow',
                        'action_items': [
                            'Visit customers with large overdue amounts personally',
                            'Offer payment plans (EMI) for large amounts',
                            'Consider legal notice for amounts >₹50,000',
                            'Stop supplying to chronic defaulters'
                        ]
                    })
        except Exception as e:
            logger.error(f"Error analyzing customer credit: {e}")
        
        cursor.close()
        return {'recommendations': recommendations, 'alerts': alerts}
    
    def _analyze_supplier_payments(self, conn) -> Dict:
        """Analyze supplier payment patterns"""
        cursor = conn.cursor()
        recommendations = []
        
        try:
            # Get pending supplier payments
            cursor.execute("""
                SELECT 
                    COUNT(*) as pending_count,
                    SUM(payment_amount) as total_pending,
                    MAX(CURRENT_DATE - payment_date) as oldest_days
                FROM public.acc_trn_payment_voucher
                WHERE is_posted = false
                AND is_cancelled = false
            """)
            result = cursor.fetchone()
            
            if result and result[0]:
                pending_count = result[0]
                total_pending = float(result[1] or 0)
                oldest_days = result[2]
                
                if oldest_days > 30:
                    recommendations.append({
                        'category': 'Supplier Relations',
                        'priority': 'HIGH',
                        'recommendation': 'Clear Pending Supplier Payments',
                        'description': f'{pending_count} payments pending (₹{total_pending:,.0f}), oldest: {oldest_days} days',
                        'expected_impact': 'Maintain good supplier relationships and credit terms',
                        'action_items': [
                            'Prioritize payments to critical suppliers (brake parts, engine parts)',
                            'Negotiate extended terms if cash is tight',
                            'Clear payments >30 days to avoid supply disruption',
                            'Request discounts for early payment'
                        ]
                    })
        except Exception as e:
            logger.error(f"Error analyzing supplier payments: {e}")
        
        cursor.close()
        return {'recommendations': recommendations}
    
    def _analyze_cashflow_patterns(self, conn, predictions: List[Dict]) -> Dict:
        """Analyze cash flow patterns specific to auto parts business"""
        recommendations = []
        alerts = []
        
        # Check for weekend/weekday patterns (auto shops busier on weekends)
        if predictions:
            # Analyze if there are low cash days
            low_balance_days = [p for p in predictions if p['predicted_balance'] < 10000]
            
            if len(low_balance_days) > 5:
                alerts.append({
                    'type': 'WARNING',
                    'title': 'Multiple Low Cash Days Ahead',
                    'message': f'{len(low_balance_days)} days with balance <₹10,000',
                    'action': 'Plan cash reserves for lean periods'
                })
                
                recommendations.append({
                    'category': 'Cash Reserve',
                    'priority': 'MEDIUM',
                    'recommendation': 'Build Cash Buffer',
                    'description': 'Auto parts business needs cash buffer for inventory purchases',
                    'expected_impact': 'Avoid missing bulk purchase opportunities',
                    'action_items': [
                        'Maintain minimum ₹20,000 cash reserve',
                        'Set up overdraft facility with bank',
                        'Accelerate collections before making large purchases',
                        'Consider invoice discounting for immediate cash'
                    ]
                })
        
        return {'recommendations': recommendations, 'alerts': alerts}
    
    def _analyze_profitability(self, conn) -> Dict:
        """Analyze profit margins"""
        cursor = conn.cursor()
        recommendations = []
        insights = []
        
        try:
            # Get revenue and COGS for last 30 days
            cursor.execute("""
                SELECT 
                    (SELECT SUM(jd.credit_amount) 
                     FROM public.acc_journal_detail jd
                     JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
                     JOIN public.acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
                     WHERE coa.account_nature = 'SALES_REV'
                     AND jm.journal_date >= CURRENT_DATE - INTERVAL '30 days') as revenue,
                    (SELECT SUM(jd.debit_amount)
                     FROM public.acc_journal_detail jd
                     JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
                     JOIN public.acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
                     WHERE coa.account_nature = 'COGS'
                     AND jm.journal_date >= CURRENT_DATE - INTERVAL '30 days') as cogs
            """)
            result = cursor.fetchone()
            
            if result and result[0]:
                revenue = float(result[0] or 0)
                cogs = float(result[1] or 0)
                gross_profit = revenue - cogs
                margin_pct = (gross_profit / revenue * 100) if revenue > 0 else 0
                
                insights.append({
                    'metric': 'Gross Profit Margin',
                    'value': f'{margin_pct:.1f}%',
                    'status': 'good' if margin_pct > 25 else 'warning' if margin_pct > 15 else 'critical'
                })
                
                if margin_pct < 20:
                    recommendations.append({
                        'category': 'Profitability',
                        'priority': 'HIGH',
                        'recommendation': 'Improve Profit Margins',
                        'description': f'Current margin: {margin_pct:.1f}% (Industry standard: 25-35%)',
                        'expected_impact': f'Increase monthly profit by ₹{revenue * 0.1:,.0f}',
                        'action_items': [
                            'Review pricing - increase prices by 5-10% on slow-moving items',
                            'Negotiate better rates with suppliers (target 5% discount)',
                            'Focus on high-margin products (filters, oils, accessories)',
                            'Reduce discounts - limit to 5% maximum',
                            'Add value-added services (installation, warranty)'
                        ]
                    })
                elif margin_pct > 35:
                    recommendations.append({
                        'category': 'Market Share',
                        'priority': 'MEDIUM',
                        'recommendation': 'Expand Market Share',
                        'description': f'Strong margins ({margin_pct:.1f}%) allow competitive pricing',
                        'expected_impact': 'Increase sales volume by 20-30%',
                        'action_items': [
                            'Offer competitive prices to attract more customers',
                            'Run promotional campaigns',
                            'Expand product range',
                            'Improve customer service and retention'
                        ]
                    })
        except Exception as e:
            logger.error(f"Error analyzing profitability: {e}")
        
        cursor.close()
        return {'recommendations': recommendations, 'insights': insights}


# Global instance
auto_parts_bi = AutoPartsBusinessIntelligence()
