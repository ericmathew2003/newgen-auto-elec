# Cash Flow Prediction System Using Pattern Recognition and Time-Series Analysis
# A Proactive Approach to Working Capital Management in SMEs

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class CashFlowPredictor:
    """
    Intelligent Cash Flow Prediction System using Machine Learning
    
    Features:
    - Pattern Recognition: Identifies recurring cash flow patterns
    - Time-Series Analysis: Analyzes trends and seasonality
    - Risk Assessment: Calculates risk scores and alerts
    - Scenario Planning: What-if analysis capabilities
    - Smart Recommendations: AI-powered suggestions
    """
    
    def __init__(self):
        self.inflow_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.outflow_model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.historical_patterns = []
        self.seasonal_factors = {}
        
    def extract_features(self, date: datetime, historical_data: pd.DataFrame) -> np.array:
        """Extract features for ML model"""
        features = []
        
        # Time-based features
        features.append(date.day)
        features.append(date.month)
        features.append(date.weekday())
        features.append(date.day / 30.0)
        
        # Cyclical encoding
        features.append(np.sin(2 * np.pi * date.month / 12))
        features.append(np.cos(2 * np.pi * date.month / 12))
        features.append(np.sin(2 * np.pi * date.weekday() / 7))
        features.append(np.cos(2 * np.pi * date.weekday() / 7))
        
        # Historical patterns
        if len(historical_data) > 0:
            # Use fillna to handle NaN values
            net_flow = historical_data['net_flow'].fillna(0)
            
            features.append(net_flow.tail(7).mean() if len(net_flow) >= 7 else net_flow.mean())
            features.append(net_flow.tail(30).mean() if len(net_flow) >= 30 else net_flow.mean())
            features.append(net_flow.tail(30).std() if len(net_flow) >= 30 else net_flow.std())
            
            if len(historical_data) >= 30:
                recent_avg = net_flow.tail(15).mean()
                older_avg = net_flow.iloc[-30:-15].mean() if len(net_flow) >= 30 else net_flow.mean()
                trend = (recent_avg - older_avg) / older_avg if older_avg != 0 else 0
                features.append(trend)
            else:
                features.append(0)
        else:
            features.extend([0, 0, 0, 0])
        
        # Replace any NaN with 0
        features = [0 if np.isnan(f) else f for f in features]
        
        return np.array(features).reshape(1, -1)
    
    def prepare_training_data(self, cash_flow_data: pd.DataFrame) -> Tuple[np.array, np.array, np.array]:
        """Prepare data for training"""
        X_inflow = []
        X_outflow = []
        y_inflow = []
        y_outflow = []
        
        for idx in range(len(cash_flow_data)):
            row = cash_flow_data.iloc[idx]
            date = row['date']
            
            # Get historical data up to this point
            historical = cash_flow_data.iloc[:idx] if idx > 0 else pd.DataFrame()
            
            # Extract features
            features = self.extract_features(date, historical)
            
            # Replace NaN with 0
            features = np.nan_to_num(features, nan=0.0)
            
            X_inflow.append(features[0])
            X_outflow.append(features[0])
            y_inflow.append(row['inflow'])
            y_outflow.append(row['outflow'])
        
        # Replace any remaining NaN values
        X_inflow = np.nan_to_num(np.array(X_inflow), nan=0.0)
        X_outflow = np.nan_to_num(np.array(X_outflow), nan=0.0)
        y_inflow = np.nan_to_num(np.array(y_inflow), nan=0.0)
        y_outflow = np.nan_to_num(np.array(y_outflow), nan=0.0)
        
        return X_inflow, X_outflow, y_inflow, y_outflow
    
    def fit(self, cash_flow_data: pd.DataFrame):
        """Train the models"""
        logger.info(f"Training with {len(cash_flow_data)} data points")
        
        if len(cash_flow_data) < 7:  # Reduced from 30 to 7 for demo purposes
            logger.warning("Need at least 7 days of history")
            return False
        
        X_inflow, X_outflow, y_inflow, y_outflow = self.prepare_training_data(cash_flow_data)
        
        X_in_train, X_in_test, y_in_train, y_in_test = train_test_split(
            X_inflow, y_inflow, test_size=0.2, random_state=42
        )
        X_out_train, X_out_test, y_out_train, y_out_test = train_test_split(
            X_outflow, y_outflow, test_size=0.2, random_state=42
        )
        
        self.inflow_model.fit(X_in_train, y_in_train)
        self.outflow_model.fit(X_out_train, y_out_train)
        
        inflow_pred = self.inflow_model.predict(X_in_test)
        outflow_pred = self.outflow_model.predict(X_out_test)
        
        inflow_mape = mean_absolute_percentage_error(y_in_test, inflow_pred) * 100
        outflow_mape = mean_absolute_percentage_error(y_out_test, outflow_pred) * 100
        
        logger.info(f"Inflow MAPE: {inflow_mape:.2f}%")
        logger.info(f"Outflow MAPE: {outflow_mape:.2f}%")
        
        self.is_fitted = True
        self.historical_patterns = cash_flow_data.to_dict('records')
        self._calculate_seasonal_factors(cash_flow_data)
        
        return True
    
    def _calculate_seasonal_factors(self, data: pd.DataFrame):
        """Calculate seasonal factors"""
        # Ensure date column is datetime
        if not pd.api.types.is_datetime64_any_dtype(data['date']):
            data['date'] = pd.to_datetime(data['date'])
        
        monthly_avg = data.groupby(data['date'].dt.month)['net_flow'].mean()
        overall_avg = data['net_flow'].mean()
        
        for month in range(1, 13):
            if month in monthly_avg.index:
                self.seasonal_factors[month] = monthly_avg[month] / overall_avg if overall_avg != 0 else 1.0
            else:
                self.seasonal_factors[month] = 1.0
    
    def predict(self, start_date: datetime, days_ahead: int, current_balance: float, 
                historical_data: pd.DataFrame, conn=None) -> Dict:
        """Predict cash flow"""
        if not self.is_fitted:
            return self._fallback_prediction(start_date, days_ahead, current_balance, historical_data)
        
        predictions = []
        running_balance = current_balance
        
        for day in range(days_ahead):
            pred_date = start_date + timedelta(days=day)
            features = self.extract_features(pred_date, historical_data)
            
            predicted_inflow = max(0, self.inflow_model.predict(features)[0])
            predicted_outflow = max(0, self.outflow_model.predict(features)[0])
            
            seasonal_factor = self.seasonal_factors.get(pred_date.month, 1.0)
            predicted_inflow *= seasonal_factor
            predicted_outflow *= seasonal_factor
            
            net_flow = predicted_inflow - predicted_outflow
            running_balance += net_flow
            confidence = max(50, 95 - (day * 1.5))
            
            predictions.append({
                'date': pred_date.strftime('%Y-%m-%d'),
                'day': day + 1,
                'predicted_inflow': round(predicted_inflow, 2),
                'predicted_outflow': round(predicted_outflow, 2),
                'net_flow': round(net_flow, 2),
                'predicted_balance': round(running_balance, 2),
                'confidence': round(confidence, 1)
            })
        
        total_inflow = sum(p['predicted_inflow'] for p in predictions)
        total_outflow = sum(p['predicted_outflow'] for p in predictions)
        min_balance = min(p['predicted_balance'] for p in predictions)
        max_balance = max(p['predicted_balance'] for p in predictions)
        
        risk_assessment = self._assess_risk(predictions, current_balance)
        alerts = self._generate_alerts(predictions, current_balance)
        recommendations = self._generate_recommendations(predictions, risk_assessment, alerts, conn)
        patterns = self._identify_patterns(historical_data)
        
        return {
            'predictions': predictions,
            'summary': {
                'current_balance': round(current_balance, 2),
                'predicted_final_balance': round(predictions[-1]['predicted_balance'], 2),
                'total_inflow': round(total_inflow, 2),
                'total_outflow': round(total_outflow, 2),
                'net_change': round(total_inflow - total_outflow, 2),
                'min_balance': round(min_balance, 2),
                'max_balance': round(max_balance, 2),
                'avg_daily_inflow': round(total_inflow / days_ahead, 2),
                'avg_daily_outflow': round(total_outflow / days_ahead, 2),
                'forecast_period_days': days_ahead
            },
            'risk_assessment': risk_assessment,
            'alerts': alerts,
            'recommendations': recommendations,
            'patterns': patterns,
            'model_info': {
                'algorithm': 'Random Forest + Gradient Boosting',
                'is_fitted': self.is_fitted,
                'training_data_points': len(self.historical_patterns),
                'features_used': 12
            }
        }
    
    def _assess_risk(self, predictions: List[Dict], current_balance: float) -> Dict:
        """Assess risk"""
        risk_score = 0
        risk_factors = []
        
        min_balance = min(p['predicted_balance'] for p in predictions)
        if min_balance < 0:
            risk_score += 40
            risk_factors.append({
                'factor': 'Negative Balance Predicted',
                'severity': 'CRITICAL',
                'impact': 40,
                'description': f'Balance may go negative (₹{min_balance:,.2f})'
            })
        elif min_balance < current_balance * 0.2:
            risk_score += 25
            risk_factors.append({
                'factor': 'Low Balance Warning',
                'severity': 'HIGH',
                'impact': 25,
                'description': f'Balance may drop below 20%'
            })
        
        balances = [p['predicted_balance'] for p in predictions]
        volatility = np.std(balances)
        avg_balance = np.mean(balances)
        volatility_ratio = volatility / avg_balance if avg_balance != 0 else 0
        
        if volatility_ratio > 0.3:
            risk_score += 20
            risk_factors.append({
                'factor': 'High Volatility',
                'severity': 'MEDIUM',
                'impact': 20,
                'description': f'High cash flow volatility ({volatility_ratio*100:.1f}%)'
            })
        
        first_week_avg = np.mean([p['predicted_balance'] for p in predictions[:7]])
        last_week_avg = np.mean([p['predicted_balance'] for p in predictions[-7:]])
        trend = (last_week_avg - first_week_avg) / first_week_avg if first_week_avg != 0 else 0
        
        if trend < -0.1:
            risk_score += 15
            risk_factors.append({
                'factor': 'Declining Trend',
                'severity': 'MEDIUM',
                'impact': 15,
                'description': f'Balance trending downward ({trend*100:.1f}%)'
            })
        
        if risk_score >= 60:
            risk_level, risk_color = 'CRITICAL', 'red'
        elif risk_score >= 35:
            risk_level, risk_color = 'HIGH', 'orange'
        elif risk_score >= 15:
            risk_level, risk_color = 'MEDIUM', 'yellow'
        else:
            risk_level, risk_color = 'LOW', 'green'
        
        return {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risk_color': risk_color,
            'risk_factors': risk_factors,
            'overall_assessment': self._get_risk_text(risk_level, risk_score)
        }
    
    def _get_risk_text(self, level: str, score: int) -> str:
        """Get risk text"""
        texts = {
            'CRITICAL': f'Critical risk (Score: {score}/100). Immediate action required.',
            'HIGH': f'High risk (Score: {score}/100). Proactive measures recommended.',
            'MEDIUM': f'Moderate risk (Score: {score}/100). Monitor closely.',
            'LOW': f'Low risk (Score: {score}/100). Cash position healthy.'
        }
        return texts.get(level, 'Unknown')
    
    def _generate_alerts(self, predictions: List[Dict], current_balance: float) -> List[Dict]:
        """Generate alerts"""
        alerts = []
        
        for pred in predictions:
            balance = pred['predicted_balance']
            
            if balance < 0:
                alerts.append({
                    'type': 'CRITICAL',
                    'day': pred['day'],
                    'date': pred['date'],
                    'title': 'Cash Shortage Alert',
                    'message': f'Negative balance predicted: ₹{balance:,.2f}',
                    'action': 'Arrange immediate funding',
                    'priority': 1
                })
            elif balance < current_balance * 0.2:
                alerts.append({
                    'type': 'WARNING',
                    'day': pred['day'],
                    'date': pred['date'],
                    'title': 'Low Balance Warning',
                    'message': f'Balance dropping to ₹{balance:,.2f}',
                    'action': 'Accelerate collections',
                    'priority': 2
                })
            
            if pred['predicted_outflow'] > pred['predicted_inflow'] * 1.5:
                outflow = pred['predicted_outflow']
                inflow = pred['predicted_inflow']
                ratio = outflow / inflow if inflow > 0 else 0
                alerts.append({
                    'type': 'INFO',
                    'day': pred['day'],
                    'date': pred['date'],
                    'title': f'High Outflow Day (Day {pred["day"]})',
                    'message': f'Outflow ₹{outflow:,.2f} exceeds inflow ₹{inflow:,.2f} ({ratio:.1f}x)',
                    'action': 'Verify scheduled payments and ensure sufficient balance',
                    'priority': 3
                })
        
        alerts.sort(key=lambda x: x['priority'])
        return alerts[:10]
    
    def _generate_recommendations(self, predictions: List[Dict], risk: Dict, alerts: List[Dict], conn=None) -> List[Dict]:
        """Generate recommendations including supplier payment analysis"""
        recommendations = []
        
        # Calculate prediction metrics
        days_ahead = len(predictions)
        avg_daily_inflow = np.mean([p['predicted_inflow'] for p in predictions])
        avg_daily_outflow = np.mean([p['predicted_outflow'] for p in predictions])
        final_balance = predictions[-1]['predicted_balance']
        min_balance = min(p['predicted_balance'] for p in predictions)
        
        # Analyze pending supplier payments if connection provided
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT 
                        p.partyname,
                        COUNT(*) as payment_count,
                        SUM(pv.payment_amount) as total_amount,
                        MIN(pv.payment_date) as oldest_payment,
                        CURRENT_DATE - MIN(pv.payment_date) as days_pending
                    FROM acc_trn_payment_voucher pv
                    JOIN tblmasparty p ON pv.party_id = p.partyid
                    WHERE pv.is_posted = false AND pv.is_cancelled = false
                    GROUP BY p.partyname
                    ORDER BY days_pending DESC
                    LIMIT 5
                """)
                pending_payments = cursor.fetchall()
                
                # Get customer receivables analysis
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT party_id) as customer_count,
                        SUM(balance_amount) as total_outstanding,
                        AVG(CURRENT_DATE - tran_date) as avg_days_outstanding
                    FROM acc_trn_invoice
                    WHERE tran_type = 'SAL' 
                    AND balance_amount > 0
                """)
                receivables = cursor.fetchone()
                
                cursor.close()
                
                # Supplier payment recommendations
                if pending_payments:
                    total_pending = sum(row[2] for row in pending_payments)
                    oldest_days = pending_payments[0][4]
                    
                    supplier_list = [f"{row[0]} (₹{row[2]:,.2f}, {row[4]} days)" for row in pending_payments[:3]]
                    
                    priority = 'CRITICAL' if oldest_days > 45 else 'HIGH' if oldest_days > 30 else 'MEDIUM'
                    
                    recommendations.append({
                        'category': 'Supplier Payments',
                        'priority': priority,
                        'recommendation': f'Process {len(pending_payments)} Pending Supplier Payments',
                        'description': f'Total ₹{total_pending:,.2f} in unposted payments. Oldest: {oldest_days} days',
                        'expected_impact': f'Maintain supplier relationships and avoid late fees',
                        'action_items': [
                            f'Review and post {len(pending_payments)} pending payment vouchers',
                            f'Prioritize: {supplier_list[0] if supplier_list else "N/A"}',
                            'Verify bank balances before posting',
                            'Consider payment terms negotiation if cash is tight'
                        ]
                    })
                
                # Customer receivables recommendations
                if receivables and receivables[1] and receivables[1] > 0:
                    total_outstanding = float(receivables[1])
                    avg_days = int(receivables[2] or 0)
                    customer_count = receivables[0]
                    
                    if avg_days > 45 or total_outstanding > avg_daily_inflow * 30:
                        recommendations.append({
                            'category': 'Receivables Management',
                            'priority': 'HIGH',
                            'recommendation': 'Accelerate Customer Collections',
                            'description': f'₹{total_outstanding:,.2f} outstanding from {customer_count} customers (avg {avg_days} days)',
                            'expected_impact': f'Could improve cash flow by ₹{total_outstanding * 0.3:,.2f} in next {days_ahead} days',
                            'action_items': [
                                f'Follow up with customers having invoices older than {avg_days} days',
                                'Offer 2-3% early payment discount for immediate settlement',
                                'Send payment reminders via email/SMS',
                                'Consider invoice factoring for large outstanding amounts'
                            ]
                        })
                    elif avg_days > 30:
                        recommendations.append({
                            'category': 'Receivables Management',
                            'priority': 'MEDIUM',
                            'recommendation': 'Monitor Customer Payment Patterns',
                            'description': f'₹{total_outstanding:,.2f} outstanding with average {avg_days} days aging',
                            'expected_impact': 'Prevent payment delays and maintain healthy cash flow',
                            'action_items': [
                                'Review credit terms for slow-paying customers',
                                'Implement automated payment reminders',
                                'Consider advance payment incentives for new orders'
                            ]
                        })
                        
            except Exception as e:
                logger.error(f"Error analyzing supplier payments: {e}")
        
        # Cash flow trend analysis
        if days_ahead >= 30:
            first_week_balance = np.mean([p['predicted_balance'] for p in predictions[:7]])
            last_week_balance = np.mean([p['predicted_balance'] for p in predictions[-7:]])
            trend = (last_week_balance - first_week_balance) / first_week_balance if first_week_balance != 0 else 0
            
            if trend < -0.15:
                recommendations.append({
                    'category': 'Cash Flow Trend',
                    'priority': 'HIGH',
                    'recommendation': 'Address Declining Cash Flow Trend',
                    'description': f'Cash balance declining by {abs(trend)*100:.1f}% over {days_ahead} days',
                    'expected_impact': 'Stabilize cash position and prevent shortages',
                    'action_items': [
                        'Review and reduce discretionary expenses',
                        'Analyze profitability of recent sales',
                        'Consider temporary credit line for working capital',
                        'Evaluate pricing strategy and margins'
                    ]
                })
            elif trend > 0.15:
                recommendations.append({
                    'category': 'Growth Opportunity',
                    'priority': 'MEDIUM',
                    'recommendation': 'Leverage Positive Cash Flow',
                    'description': f'Cash balance improving by {trend*100:.1f}% over {days_ahead} days',
                    'expected_impact': 'Optimize excess cash for business growth',
                    'action_items': [
                        'Consider inventory expansion for high-demand items',
                        'Invest in marketing to capture more market share',
                        'Negotiate bulk purchase discounts with suppliers',
                        'Explore short-term investment opportunities'
                    ]
                })
        
        # Working capital optimization
        if avg_daily_outflow > avg_daily_inflow * 1.1:
            recommendations.append({
                'category': 'Working Capital',
                'priority': 'HIGH',
                'recommendation': 'Optimize Working Capital Management',
                'description': f'Daily outflow (₹{avg_daily_outflow:,.2f}) exceeds inflow (₹{avg_daily_inflow:,.2f})',
                'expected_impact': 'Reduce cash burn rate by 10-15%',
                'action_items': [
                    'Review inventory turnover and reduce slow-moving stock',
                    'Negotiate better payment terms with suppliers',
                    'Implement just-in-time inventory practices',
                    'Analyze and reduce operational costs'
                ]
            })
        
        # Risk-based recommendations
        if risk['risk_level'] in ['CRITICAL', 'HIGH']:
            if min_balance < 0:
                shortage = abs(min_balance)
                recommendations.append({
                    'category': 'Financing',
                    'priority': 'CRITICAL',
                    'recommendation': 'Arrange Short-term Financing',
                    'description': f'Predicted cash shortage of ₹{shortage:,.2f} within {days_ahead} days',
                    'expected_impact': 'Prevent business disruption and maintain operations',
                    'action_items': [
                        f'Arrange overdraft facility for ₹{shortage * 1.5:,.2f}',
                        'Consider invoice discounting for immediate cash',
                        'Explore short-term business loans',
                        'Contact bank to discuss working capital solutions'
                    ]
                })
            
            recommendations.append({
                'category': 'Payment Management',
                'priority': 'HIGH',
                'recommendation': 'Prioritize Critical Payments',
                'description': 'High cash flow risk requires careful payment management',
                'expected_impact': 'Preserve ₹50,000-100,000 in working capital',
                'action_items': [
                    'Defer non-essential expenses',
                    'Negotiate extended payment terms with suppliers',
                    'Prioritize payments to critical suppliers only',
                    'Review and cancel unnecessary subscriptions/services'
                ]
            })
        
        # Seasonal/pattern-based recommendations
        if days_ahead >= 60:
            recommendations.append({
                'category': 'Strategic Planning',
                'priority': 'MEDIUM',
                'recommendation': 'Plan for Long-term Cash Flow',
                'description': f'60-day forecast shows final balance of ₹{final_balance:,.2f}',
                'expected_impact': 'Better preparedness for future cash needs',
                'action_items': [
                    'Create monthly cash flow budget',
                    'Identify seasonal patterns in your business',
                    'Build cash reserves for lean periods',
                    'Review and adjust business strategy quarterly'
                ]
            })
        
        return recommendations
    
    def _identify_patterns(self, historical_data: pd.DataFrame) -> Dict:
        """Identify detailed cash flow patterns"""
        if len(historical_data) < 7:
            return {'status': 'insufficient_data', 'patterns': []}
        
        # Ensure date column is datetime
        if not pd.api.types.is_datetime64_any_dtype(historical_data['date']):
            historical_data = historical_data.copy()
            historical_data['date'] = pd.to_datetime(historical_data['date'])
        
        patterns = []
        
        # 1. Day of Week Pattern
        weekly_data = historical_data.groupby(historical_data['date'].dt.dayofweek).agg({
            'inflow': 'mean',
            'outflow': 'mean',
            'net_flow': 'mean'
        })
        
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        best_day_idx = weekly_data['net_flow'].idxmax()
        worst_day_idx = weekly_data['net_flow'].idxmin()
        best_inflow_idx = weekly_data['inflow'].idxmax()
        best_outflow_idx = weekly_data['outflow'].idxmax()
        
        patterns.append({
            'type': 'Weekly Cash Flow Pattern',
            'description': f'Best day: {day_names[best_day_idx]} (₹{weekly_data.loc[best_day_idx, "net_flow"]:,.0f} net), Worst: {day_names[worst_day_idx]} (₹{weekly_data.loc[worst_day_idx, "net_flow"]:,.0f} net)',
            'insight': f'Schedule major payments on {day_names[best_day_idx]} when cash flow is strongest',
            'details': {
                'best_day': day_names[best_day_idx],
                'worst_day': day_names[worst_day_idx],
                'best_inflow_day': day_names[best_inflow_idx],
                'highest_outflow_day': day_names[best_outflow_idx],
                'weekly_breakdown': [
                    {
                        'day': day_names[i],
                        'avg_inflow': float(weekly_data.loc[i, 'inflow']) if i in weekly_data.index else 0,
                        'avg_outflow': float(weekly_data.loc[i, 'outflow']) if i in weekly_data.index else 0,
                        'avg_net': float(weekly_data.loc[i, 'net_flow']) if i in weekly_data.index else 0
                    }
                    for i in range(7)
                ]
            }
        })
        
        # 2. Cash Flow Volatility
        volatility = historical_data['net_flow'].std()
        avg_net_flow = historical_data['net_flow'].mean()
        volatility_ratio = (volatility / abs(avg_net_flow)) if avg_net_flow != 0 else 0
        
        if volatility_ratio > 1.5:
            patterns.append({
                'type': 'High Volatility',
                'description': f'Cash flow varies significantly (±₹{volatility:,.0f})',
                'insight': 'Maintain higher cash reserves to handle fluctuations',
                'details': {
                    'volatility': float(volatility),
                    'avg_net_flow': float(avg_net_flow),
                    'volatility_ratio': float(volatility_ratio)
                }
            })
        elif volatility_ratio < 0.5:
            patterns.append({
                'type': 'Stable Cash Flow',
                'description': f'Consistent cash flow pattern (±₹{volatility:,.0f})',
                'insight': 'Predictable cash flow allows for better planning',
                'details': {
                    'volatility': float(volatility),
                    'avg_net_flow': float(avg_net_flow),
                    'volatility_ratio': float(volatility_ratio)
                }
            })
        
        # 3. Trend Analysis
        if len(historical_data) >= 14:
            recent_avg = historical_data.tail(7)['net_flow'].mean()
            older_avg = historical_data.iloc[-14:-7]['net_flow'].mean()
            
            if older_avg != 0:
                trend_pct = ((recent_avg - older_avg) / abs(older_avg)) * 100
                
                if trend_pct > 10:
                    patterns.append({
                        'type': 'Improving Trend',
                        'description': f'Cash flow improving by {trend_pct:.1f}% (₹{recent_avg:,.0f} vs ₹{older_avg:,.0f})',
                        'insight': 'Positive momentum - consider growth investments or debt reduction',
                        'details': {
                            'recent_avg': float(recent_avg),
                            'older_avg': float(older_avg),
                            'trend_pct': float(trend_pct)
                        }
                    })
                elif trend_pct < -10:
                    patterns.append({
                        'type': 'Declining Trend',
                        'description': f'Cash flow declining by {abs(trend_pct):.1f}% (₹{recent_avg:,.0f} vs ₹{older_avg:,.0f})',
                        'insight': 'Review expenses and accelerate collections',
                        'details': {
                            'recent_avg': float(recent_avg),
                            'older_avg': float(older_avg),
                            'trend_pct': float(trend_pct)
                        }
                    })
        
        # 4. Inflow vs Outflow Balance
        total_inflow = historical_data['inflow'].sum()
        total_outflow = historical_data['outflow'].sum()
        
        if total_inflow > 0:
            outflow_ratio = (total_outflow / total_inflow) * 100
            
            patterns.append({
                'type': 'Cash Flow Balance',
                'description': f'Outflow is {outflow_ratio:.1f}% of inflow (₹{total_outflow:,.0f} out vs ₹{total_inflow:,.0f} in)',
                'insight': 'Healthy' if outflow_ratio < 90 else 'Tight' if outflow_ratio < 100 else 'Deficit - need to increase revenue or reduce costs',
                'details': {
                    'total_inflow': float(total_inflow),
                    'total_outflow': float(total_outflow),
                    'outflow_ratio': float(outflow_ratio),
                    'net_position': float(total_inflow - total_outflow)
                }
            })
        
        # 5. Peak and Low Periods
        if len(historical_data) >= 7:
            historical_data_sorted = historical_data.sort_values('net_flow', ascending=False)
            best_days = historical_data_sorted.head(3)
            worst_days = historical_data_sorted.tail(3)
            
            patterns.append({
                'type': 'Peak & Low Periods',
                'description': f'Best day: {best_days.iloc[0]["date"].strftime("%Y-%m-%d")} (₹{best_days.iloc[0]["net_flow"]:,.0f}), Worst: {worst_days.iloc[0]["date"].strftime("%Y-%m-%d")} (₹{worst_days.iloc[0]["net_flow"]:,.0f})',
                'insight': 'Understand what drives your best and worst cash flow days',
                'details': {
                    'best_days': [
                        {
                            'date': row['date'].strftime('%Y-%m-%d'),
                            'net_flow': float(row['net_flow']),
                            'inflow': float(row['inflow']),
                            'outflow': float(row['outflow'])
                        }
                        for _, row in best_days.iterrows()
                    ],
                    'worst_days': [
                        {
                            'date': row['date'].strftime('%Y-%m-%d'),
                            'net_flow': float(row['net_flow']),
                            'inflow': float(row['inflow']),
                            'outflow': float(row['outflow'])
                        }
                        for _, row in worst_days.iterrows()
                    ]
                }
            })
        
        return {'status': 'success', 'patterns': patterns, 'pattern_count': len(patterns)}
    
    def _fallback_prediction(self, start_date: datetime, days_ahead: int, 
                           current_balance: float, historical_data: pd.DataFrame) -> Dict:
        """Fallback when not fitted"""
        if len(historical_data) > 0:
            avg_inflow = historical_data['inflow'].mean()
            avg_outflow = historical_data['outflow'].mean()
            avg_volatility = historical_data['net_flow'].std()
        else:
            avg_inflow = 50000
            avg_outflow = 45000
            avg_volatility = 10000
        
        predictions = []
        running_balance = current_balance
        
        for day in range(days_ahead):
            pred_date = start_date + timedelta(days=day)
            noise = np.random.normal(0, avg_volatility * 0.1)
            
            predicted_inflow = max(0, avg_inflow + noise)
            predicted_outflow = max(0, avg_outflow + noise)
            net_flow = predicted_inflow - predicted_outflow
            running_balance += net_flow
            
            predictions.append({
                'date': pred_date.strftime('%Y-%m-%d'),
                'day': day + 1,
                'predicted_inflow': round(predicted_inflow, 2),
                'predicted_outflow': round(predicted_outflow, 2),
                'net_flow': round(net_flow, 2),
                'predicted_balance': round(running_balance, 2),
                'confidence': 60.0
            })
        
        return {
            'predictions': predictions,
            'summary': {
                'current_balance': round(current_balance, 2),
                'predicted_final_balance': round(predictions[-1]['predicted_balance'], 2),
                'total_inflow': round(sum(p['predicted_inflow'] for p in predictions), 2),
                'total_outflow': round(sum(p['predicted_outflow'] for p in predictions), 2),
                'net_change': round(sum(p['net_flow'] for p in predictions), 2),
                'min_balance': round(min(p['predicted_balance'] for p in predictions), 2),
                'max_balance': round(max(p['predicted_balance'] for p in predictions), 2),
                'avg_daily_inflow': round(sum(p['predicted_inflow'] for p in predictions) / days_ahead, 2),
                'avg_daily_outflow': round(sum(p['predicted_outflow'] for p in predictions) / days_ahead, 2),
                'forecast_period_days': days_ahead
            },
            'risk_assessment': {
                'risk_level': 'UNKNOWN',
                'risk_score': 0,
                'overall_assessment': 'Insufficient data'
            },
            'alerts': [],
            'recommendations': [{
                'category': 'Data Collection',
                'priority': 'HIGH',
                'recommendation': 'Collect More Data',
                'description': 'Need 30+ days of history',
                'action_items': ['Continue recording transactions']
            }],
            'patterns': {'status': 'insufficient_data', 'patterns': []},
            'model_info': {
                'algorithm': 'Simple Average (Fallback)',
                'is_fitted': False
            }
        }
    
    def scenario_analysis(self, base_prediction: Dict, scenarios: List[Dict]) -> Dict:
        """What-if analysis - applies all scenarios cumulatively"""
        results = []
        
        # Start with base predictions
        cumulative_modified = [pred.copy() for pred in base_prediction['predictions']]
        
        # Apply each scenario cumulatively
        for scenario in scenarios:
            day_idx = scenario['day'] - 1
            
            if 0 <= day_idx < len(cumulative_modified):
                # Apply the scenario to the specific day
                # Note: amount can be negative (e.g., delay payment = negative outflow)
                if scenario['type'] == 'inflow':
                    cumulative_modified[day_idx]['predicted_inflow'] += scenario['amount']
                elif scenario['type'] == 'outflow':
                    # For outflow: positive amount = more outflow (bad), negative amount = less outflow (good)
                    cumulative_modified[day_idx]['predicted_outflow'] += scenario['amount']
                
                # Recalculate net flow for the affected day
                cumulative_modified[day_idx]['net_flow'] = cumulative_modified[day_idx]['predicted_inflow'] - cumulative_modified[day_idx]['predicted_outflow']
                
                # Recalculate balances from the affected day onwards
                for i in range(day_idx, len(cumulative_modified)):
                    if i == 0:
                        # First day uses current balance
                        cumulative_modified[i]['predicted_balance'] = base_prediction['summary']['current_balance'] + cumulative_modified[i]['net_flow']
                    else:
                        # Subsequent days use previous day's balance
                        cumulative_modified[i]['predicted_balance'] = cumulative_modified[i-1]['predicted_balance'] + cumulative_modified[i]['net_flow']
                
                # Calculate impact after this scenario
                original_final = base_prediction['predictions'][-1]['predicted_balance']
                modified_final = cumulative_modified[-1]['predicted_balance']
                impact = modified_final - original_final
                
                results.append({
                    'scenario_name': scenario['name'],
                    'type': scenario['type'],
                    'amount': scenario['amount'],
                    'day': scenario['day'],
                    'impact_on_final_balance': round(impact, 2),
                    'modified_final_balance': round(modified_final, 2),
                    'impact_percentage': round((impact / original_final * 100) if original_final != 0 else 0, 2)
                })
        
        return {
            'base_final_balance': round(base_prediction['predictions'][-1]['predicted_balance'], 2),
            'scenarios': results
        }
