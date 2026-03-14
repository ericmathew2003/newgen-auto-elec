# Cash Flow Prediction Service - FastAPI Backend
# Integrates with your ERP accounting structure

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import logging
from cashflow_predictor import CashFlowPredictor
from analytics_service import analytics
from categorized_cashflow_service import get_category_summary, get_category_display_name
from auto_parts_business_intelligence import auto_parts_bi

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cash Flow Prediction System",
    description="Intelligent Cash Flow Prediction using ML for SMEs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'newgen'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'admin')
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Pydantic models
class ScenarioInput(BaseModel):
    name: str
    type: str  # 'inflow' or 'outflow'
    amount: float
    day: int

class PredictionRequest(BaseModel):
    days_ahead: int = 30
    scenarios: Optional[List[ScenarioInput]] = None

# Initialize predictor
predictor = CashFlowPredictor()

# Auto-train on startup
@app.on_event("startup")
async def startup_event():
    """Train model automatically on service startup"""
    try:
        print("🚀 Starting Cash Flow Prediction Service...")
        print("🤖 Auto-training model on startup...")
        
        # Train the model automatically
        conn = None
        try:
            conn = get_db()
            if conn:
                historical_data = fetch_cash_flow_data(days_back=180)
                if len(historical_data) >= 7:
                    predictor.fit(historical_data)
                    print("✅ Model trained successfully on startup!")
                else:
                    print(f"⚠️ Insufficient data ({len(historical_data)} days) - need at least 7 days")
            else:
                print("❌ Database connection failed - model not trained")
        except Exception as e:
            print(f"⚠️ Auto-training failed: {e}")
            print("💡 You can manually train using the /train endpoint")
        finally:
            if conn:
                conn.close()
                
    except Exception as e:
        print(f"❌ Startup error: {e}")

def fetch_cash_flow_data(days_back: int = 90) -> pd.DataFrame:
    """
    Fetch cash flow data from journal entries
    This captures ALL transactions that affect cash/bank accounts:
    - Sales, Sales Returns
    - Purchases, Purchase Returns  
    - Receipt Vouchers, Payment Vouchers
    - Any other cash transactions
    """
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    # Get all journal entries that affect cash/bank accounts
    # Debit to cash/bank = Inflow (money coming in)
    # Credit to cash/bank = Outflow (money going out)
    cash_flow_query = """
        SELECT 
            jm.journal_date as date,
            SUM(CASE 
                WHEN jd.debit_amount > 0 THEN jd.debit_amount 
                ELSE 0 
            END) as inflow,
            SUM(CASE 
                WHEN jd.credit_amount > 0 THEN jd.credit_amount 
                ELSE 0 
            END) as outflow
        FROM public.acc_journal_master jm
        JOIN public.acc_journal_detail jd ON jm.journal_mas_id = jd.journal_mas_id
        JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
        WHERE jm.journal_date >= %(start_date)s
        AND coa.is_active = true
        AND (
            UPPER(TRIM(coa.account_nature)) IN ('CASH', 'BANK', 'CASH IN HAND', 'BANK ACCOUNT', 'CASH_HAND', 'BANK_ACC')
            OR UPPER(coa.account_name) LIKE '%%CASH%%'
            OR UPPER(coa.account_name) LIKE '%%BANK%%'
        )
        GROUP BY jm.journal_date
        ORDER BY jm.journal_date
    """
    
    try:
        cursor.execute(cash_flow_query, {'start_date': start_date})
        journal_data = cursor.fetchall()
        
        # Process data into DataFrame
        df_data = []
        for row in journal_data:
            df_data.append({
                'date': pd.to_datetime(row['date']),  # Ensure datetime type
                'inflow': float(row['inflow'] or 0),
                'outflow': float(row['outflow'] or 0),
                'net_flow': float(row['inflow'] or 0) - float(row['outflow'] or 0)
            })
        
        df = pd.DataFrame(df_data)
        if len(df) > 0:
            df = df.sort_values('date')
            df['date'] = pd.to_datetime(df['date'])  # Ensure datetime type
        
        cursor.close()
        conn.close()
        
        logger.info(f"Fetched {len(df)} days of cash flow data from journal entries")
        return df
        
    except Exception as e:
        logger.error(f"Error fetching cash flow data: {e}")
        import traceback
        logger.error(traceback.format_exc())
        cursor.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

def get_current_cash_balance() -> float:
    """Get current cash balance from bank/cash accounts"""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get cash and bank account balances
        query = """
            SELECT 
                SUM(jd.debit_amount - jd.credit_amount) as balance
            FROM public.acc_journal_detail jd
            JOIN public.acc_mas_coa coa ON jd.account_id = coa.account_id
            WHERE (
                coa.account_nature IN ('CASH_HAND', 'BANK_ACC', 'CASH', 'BANK', 'CASH IN HAND', 'BANK ACCOUNT')
                OR UPPER(coa.account_name) LIKE '%CASH%'
                OR UPPER(coa.account_name) LIKE '%BANK%'
            )
            AND coa.is_active = true
            AND UPPER(coa.account_name) NOT LIKE '%CHARGE%'  -- Exclude "Bank charges" expense account
        """
        
        cursor.execute(query)
        result = cursor.fetchone()
        balance = float(result['balance'] or 0) if result else 0
        
        cursor.close()
        conn.close()
        
        logger.info(f"Current cash balance: Rs{balance:,.2f}")
        return balance
        
    except Exception as e:
        logger.error(f"Error fetching cash balance: {e}")
        cursor.close()
        conn.close()
        # Return a default if query fails
        return 100000.0

@app.get("/")
async def root():
    return {
        "service": "Cash Flow Prediction System",
        "version": "1.0.0",
        "description": "Intelligent cash flow prediction using ML",
        "algorithms": ["Random Forest", "Gradient Boosting", "Time-Series Analysis"]
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_fitted": predictor.is_fitted
    }

@app.post("/train")
async def train_model():
    """Train the cash flow prediction model"""
    try:
        logger.info("Starting model training...")
        
        # Fetch historical data
        historical_data = fetch_cash_flow_data(days_back=180)
        
        if len(historical_data) < 7:  # Reduced from 30 for demo
            return {
                "success": False,
                "message": "Insufficient data for training. Need at least 7 days.",
                "data_points": len(historical_data)
            }
        
        # Train the model
        success = predictor.fit(historical_data)
        
        if success:
            return {
                "success": True,
                "message": "Model trained successfully",
                "data_points": len(historical_data),
                "date_range": {
                    "from": historical_data['date'].min().strftime('%Y-%m-%d'),
                    "to": historical_data['date'].max().strftime('%Y-%m-%d')
                }
            }
        else:
            return {
                "success": False,
                "message": "Training failed",
                "data_points": len(historical_data)
            }
            
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict_cash_flow(request: PredictionRequest):
    """Predict cash flow for specified days ahead"""
    conn = None
    try:
        logger.info(f"Predicting cash flow for {request.days_ahead} days")
        
        # Get database connection
        conn = get_db()
        
        # Fetch historical data
        historical_data = fetch_cash_flow_data(days_back=90)
        
        # Get current balance
        current_balance = get_current_cash_balance()
        
        # Train if not fitted
        if not predictor.is_fitted and len(historical_data) >= 30:
            logger.info("Model not fitted. Training now...")
            predictor.fit(historical_data)
        
        # Make prediction
        start_date = datetime.now()
        prediction = predictor.predict(
            start_date=start_date,
            days_ahead=request.days_ahead,
            current_balance=current_balance,
            historical_data=historical_data,
            conn=conn
        )
        
        # Save alerts to history
        if prediction.get('alerts'):
            for alert in prediction['alerts']:
                analytics.save_alert(alert)
        
        # Detect and add anomalies
        anomalies = analytics.detect_anomalies(historical_data, conn)
        prediction['anomalies'] = anomalies
        
        # Add industry-specific business intelligence
        try:
            business_insights = auto_parts_bi.analyze_business_health(conn, prediction['predictions'])
            
            # Merge recommendations (business-specific first, then general)
            if business_insights.get('recommendations'):
                prediction['recommendations'] = business_insights['recommendations'] + prediction.get('recommendations', [])
            
            # Add business insights
            prediction['business_insights'] = business_insights.get('insights', [])
            prediction['industry'] = business_insights.get('industry', 'Retail')
        except Exception as e:
            logger.error(f"Error getting business insights: {e}")
        
        # Scenario analysis if requested
        if request.scenarios:
            scenarios_list = [s.dict() for s in request.scenarios]
            scenario_results = predictor.scenario_analysis(prediction, scenarios_list)
            prediction['scenario_analysis'] = scenario_results
        
        return prediction
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/historical-data")
async def get_historical_data(days: int = 90):
    """Get historical cash flow data"""
    try:
        data = fetch_cash_flow_data(days_back=days)
        
        if len(data) == 0:
            return {
                "data": [],
                "summary": {
                    "total_days": 0,
                    "total_inflow": 0,
                    "total_outflow": 0,
                    "net_flow": 0,
                    "avg_daily_inflow": 0,
                    "avg_daily_outflow": 0,
                    "date_range": {
                        "from": None,
                        "to": None
                    }
                }
            }
        
        return {
            "data": data.to_dict('records'),
            "summary": {
                "total_days": len(data),
                "total_inflow": float(data['inflow'].sum()),
                "total_outflow": float(data['outflow'].sum()),
                "net_flow": float(data['net_flow'].sum()),
                "avg_daily_inflow": float(data['inflow'].mean()),
                "avg_daily_outflow": float(data['outflow'].mean()),
                "date_range": {
                    "from": data['date'].min().strftime('%Y-%m-%d'),
                    "to": data['date'].max().strftime('%Y-%m-%d')
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching historical data: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/current-balance")
async def get_balance():
    """Get current cash balance"""
    try:
        balance = get_current_cash_balance()
        return {
            "current_balance": round(balance, 2),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/customers")
async def get_customer_analysis(days: int = 90):
    """Get top customers analysis"""
    try:
        conn = get_db()
        result = analytics.analyze_customers(conn, days)
        conn.close()
        return result
    except Exception as e:
        logger.error(f"Error analyzing customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/suppliers")
async def get_supplier_analysis(days: int = 90):
    """Get top suppliers analysis"""
    try:
        conn = get_db()
        result = analytics.analyze_suppliers(conn, days)
        conn.close()
        return result
    except Exception as e:
        logger.error(f"Error analyzing suppliers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/payment-patterns")
async def get_payment_patterns(days: int = 90):
    """Get customer payment behavior analysis"""
    try:
        conn = get_db()
        result = analytics.analyze_payment_patterns(conn, days)
        conn.close()
        return result
    except Exception as e:
        logger.error(f"Error analyzing payment patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/anomalies")
async def get_anomalies(days: int = 90):
    """Detect unusual transactions"""
    conn = None
    try:
        conn = get_db()
        data = fetch_cash_flow_data(days_back=days)
        anomalies = analytics.detect_anomalies(data, conn)
        return {
            "anomalies": anomalies,
            "period_days": days,
            "anomaly_count": len(anomalies)
        }
    except Exception as e:
        logger.error(f"Error detecting anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/alerts/history")
async def get_alert_history(limit: int = 50):
    """Get alert history"""
    try:
        return {
            "alerts": analytics.get_alert_history(limit),
            "total_count": len(analytics.alert_history)
        }
    except Exception as e:
        logger.error(f"Error fetching alert history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/alerts/clear")
async def clear_alert_history(days: int = 0):
    """Clear alert history. If days=0, clears all alerts. Otherwise clears alerts older than specified days."""
    try:
        if days == 0:
            # Clear all alerts
            count = len(analytics.alert_history)
            analytics.alert_history = []
            return {
                "success": True,
                "message": f"Cleared {count} alerts",
                "cleared_count": count
            }
        else:
            # Clear old alerts
            analytics.clear_old_alerts(days)
            return {
                "success": True,
                "message": f"Cleared alerts older than {days} days",
                "remaining_count": len(analytics.alert_history)
            }
    except Exception as e:
        logger.error(f"Error clearing alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/categories")
async def get_transaction_categories(days: int = 90):
    """Get cash flow breakdown by transaction category"""
    try:
        conn = get_db()
        summary = get_category_summary(conn, days)
        conn.close()
        
        # Add display names
        for cat in summary['categories']:
            cat['display_name'] = get_category_display_name(cat['category'])
        
        return summary
    except Exception as e:
        logger.error(f"Error fetching category summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
