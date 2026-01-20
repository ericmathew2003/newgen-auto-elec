# Python ML Service for Auto Parts Business Intelligence
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import train_test_split
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Optional
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Auto Parts ML Service",
    description="Machine Learning service for auto parts business intelligence",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db_connection():
    """Get PostgreSQL database connection"""
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
class SeasonalPattern(BaseModel):
    month: int
    predicted_seasonal_factor: float
    confidence: float
    seasonal_insights: Dict

class SeasonalAnalysisResponse(BaseModel):
    patterns: List[SeasonalPattern]
    summary: Dict
    algorithm: str
    business_value: str
    business_insights: Dict
    data_quality: Dict

class RevenueForecast(BaseModel):
    month: str
    predicted_revenue: float
    confidence: float
    factors: Dict

class RevenueForecastResponse(BaseModel):
    forecasts: List[RevenueForecast]
    summary: Dict
    algorithm: str
    business_value: str
    insights: Dict

# ML Classes
class SeasonalPatternAnalyzer:
    """K-Nearest Neighbors implementation for seasonal pattern analysis"""
    
    def __init__(self, k=5):
        self.k = k
        self.scaler = StandardScaler()
        self.knn_model = KNeighborsRegressor(n_neighbors=k, weights='distance')
        self.seasonal_categories = {
            'Winter': [12, 1, 2],
            'Spring': [3, 4, 5],
            'Summer': [6, 7, 8],
            'Fall': [9, 10, 11]
        }
    
    def get_temperature_factor(self, month):
        """Get temperature factor for auto parts business"""
        temperature_map = {
            1: 0.2, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9, 6: 1.0,
            7: 1.0, 8: 0.9, 9: 0.7, 10: 0.5, 11: 0.3, 12: 0.2
        }
        return temperature_map.get(month, 0.5)
    
    def get_rainfall_factor(self, month):
        """Get rainfall factor (affects tire sales, wipers, etc.)"""
        rainfall_map = {
            1: 0.1, 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.4, 6: 0.9,
            7: 1.0, 8: 0.9, 9: 0.6, 10: 0.3, 11: 0.1, 12: 0.1
        }
        return rainfall_map.get(month, 0.3)
    
    def get_holiday_factor(self, month):
        """Get holiday factor (affects sales patterns)"""
        holiday_map = {
            1: 0.8, 2: 0.9, 3: 1.1, 4: 1.0, 5: 0.9, 6: 0.8,
            7: 0.8, 8: 1.1, 9: 1.2, 10: 1.3, 11: 1.2, 12: 0.9
        }
        return holiday_map.get(month, 1.0)
    
    def get_economic_index(self, month):
        """Get economic index (general economic activity)"""
        economic_map = {
            1: 0.9, 2: 0.95, 3: 1.0, 4: 1.1, 5: 1.1, 6: 1.0,
            7: 0.9, 8: 0.9, 9: 1.0, 10: 1.2, 11: 1.1, 12: 1.0
        }
        return economic_map.get(month, 1.0)
    
    def create_feature_vector(self, month, sales_data=None):
        """Create feature vector for a given month"""
        features = {
            'month_sin': np.sin(2 * np.pi * month / 12),
            'month_cos': np.cos(2 * np.pi * month / 12),
            'temperature': self.get_temperature_factor(month),
            'rainfall': self.get_rainfall_factor(month),
            'holiday_factor': self.get_holiday_factor(month),
            'economic_index': self.get_economic_index(month)
        }
        
        if sales_data is not None:
            features.update({
                'transaction_count': sales_data.get('transaction_count', 0),
                'avg_order_value': sales_data.get('avg_order_value', 0),
                'unique_items_sold': sales_data.get('unique_items_sold', 0)
            })
        
        return list(features.values())
    
    def fit_and_predict(self, historical_data, target_months=6):
        """Fit KNN model and predict seasonal patterns"""
        if len(historical_data) < 3:
            return self._generate_default_patterns(target_months)
        
        # Prepare training data
        X = []
        y = []
        
        # Calculate overall average for normalization
        total_sales = sum(row['total_sales'] for row in historical_data)
        avg_sales = total_sales / len(historical_data) if historical_data else 1
        
        for row in historical_data:
            month = int(row['month'])
            sales_factor = row['total_sales'] / avg_sales if avg_sales > 0 else 1.0
            features = self.create_feature_vector(month, row)
            
            X.append(features)
            y.append(sales_factor)
        
        # Fit the model
        X = np.array(X)
        y = np.array(y)
        
        if len(X) > 0:
            X_scaled = self.scaler.fit_transform(X)
            self.knn_model.fit(X_scaled, y)
        
        # Generate predictions
        patterns = []
        current_month = datetime.now().month
        
        for i in range(target_months):
            target_month = ((current_month + i - 1) % 12) + 1
            features = self.create_feature_vector(target_month)
            
            if len(X) > 0:
                features_scaled = self.scaler.transform([features])
                predicted_factor = self.knn_model.predict(features_scaled)[0]
                
                # Calculate confidence based on nearest neighbors
                distances, indices = self.knn_model.kneighbors(features_scaled)
                confidence = max(20, 100 - int(np.mean(distances[0]) * 100))
            else:
                predicted_factor = 1.0
                confidence = 30
            
            patterns.append({
                'month': target_month,
                'predicted_seasonal_factor': round(predicted_factor, 3),
                'confidence': confidence,
                'seasonal_insights': self._get_seasonal_insights(target_month)
            })
        
        return patterns
    
    def _generate_default_patterns(self, months):
        """Generate default patterns when insufficient data"""
        patterns = []
        current_month = datetime.now().month
        
        # Default seasonal factors for auto parts business
        default_factors = {
            1: 1.1, 2: 1.0, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.3,
            7: 1.2, 8: 1.1, 9: 1.0, 10: 1.1, 11: 1.2, 12: 1.0
        }
        
        for i in range(months):
            target_month = ((current_month + i - 1) % 12) + 1
            patterns.append({
                'month': target_month,
                'predicted_seasonal_factor': default_factors[target_month],
                'confidence': 65,
                'seasonal_insights': self._get_seasonal_insights(target_month)
            })
        
        return patterns
    
    def _get_seasonal_insights(self, month):
        """Get seasonal insights for a month"""
        season_map = {
            (12, 1, 2): 'Winter',
            (3, 4, 5): 'Spring', 
            (6, 7, 8): 'Summer',
            (9, 10, 11): 'Fall'
        }
        
        season = 'Unknown'
        for months, season_name in season_map.items():
            if month in months:
                season = season_name
                break
        
        trends = {
            1: 'Winter maintenance peak - batteries, heaters, antifreeze',
            2: 'Late winter - continued maintenance focus',
            3: 'Spring preparation - AC servicing, tire changes',
            4: 'Spring peak - high activity across all categories',
            5: 'Pre-summer rush - AC parts, cooling systems',
            6: 'Summer season - AC components, cooling systems',
            7: 'Mid-summer - sustained AC demand',
            8: 'Late summer - continued cooling focus',
            9: 'Post-monsoon recovery - general maintenance',
            10: 'Festival season preparation - general uptick',
            11: 'Pre-winter preparation - heating systems',
            12: 'Year-end - holiday impact on sales'
        }
        
        return {
            'season': season,
            'seasonal_trend': trends.get(month, 'Normal seasonal pattern'),
            'key_factors': self._get_key_factors(month),
            'business_recommendations': self._get_business_recommendations(month)
        }
    
    def _get_key_factors(self, month):
        """Get key factors affecting this month"""
        factors = []
        
        if month in [6, 7, 8]:
            factors.append('High temperature drives AC parts demand')
        if month in [6, 7, 8, 9]:
            factors.append('Monsoon season increases wiper and tire demand')
        if month in [10, 11]:
            factors.append('Festival season boosts overall sales')
        if month in [12, 1, 2]:
            factors.append('Winter conditions increase battery and heating demand')
        if month in [3, 4, 5]:
            factors.append('Spring maintenance season drives diverse demand')
        
        return factors
    
    def _get_business_recommendations(self, month):
        """Get business recommendations for the month"""
        recommendations = []
        
        if month in [6, 7, 8]:
            recommendations.extend([
                'Stock up on AC parts, cooling systems, and refrigerants',
                'Prepare for high summer demand'
            ])
        elif month in [10, 11]:
            recommendations.extend([
                'Prepare for festival season demand surge',
                'Increase marketing efforts'
            ])
        elif month in [12, 1, 2]:
            recommendations.extend([
                'Focus on winter maintenance items - batteries, heaters',
                'Prepare for cold weather demand'
            ])
        else:
            recommendations.append('Maintain standard inventory levels')
        
        return recommendations

class NeuralNetworkForecaster:
    """Neural Network implementation for revenue forecasting"""
    
    def __init__(self):
        self.model = MLPRegressor(
            hidden_layer_sizes=(100, 50),
            activation='relu',
            solver='adam',
            max_iter=1000,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
    
    def prepare_features(self, historical_data):
        """Prepare features for neural network"""
        features = []
        targets = []
        
        for i, row in enumerate(historical_data):
            month = int(row['month'])
            
            # Create feature vector
            feature_vector = [
                month / 12.0,  # Normalized month
                np.sin(2 * np.pi * month / 12),  # Seasonal sine
                np.cos(2 * np.pi * month / 12),  # Seasonal cosine
                row.get('transaction_count', 0) / 100.0,  # Normalized transaction count
                row.get('avg_order_value', 0) / 10000.0,  # Normalized AOV
                i / len(historical_data)  # Trend factor
            ]
            
            features.append(feature_vector)
            targets.append(row['total_sales'])
        
        return np.array(features), np.array(targets)
    
    def fit_and_predict(self, historical_data, months=6):
        """Fit neural network and generate revenue forecasts"""
        if len(historical_data) < 3:
            return self._generate_default_forecasts(months)
        
        # Prepare training data
        X, y = self.prepare_features(historical_data)
        
        if len(X) > 2:
            # Split data for validation
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            
            # Train model
            self.model.fit(X_train_scaled, y_train)
            self.is_fitted = True
        
        # Generate forecasts
        forecasts = []
        current_date = datetime.now()
        
        for i in range(1, months + 1):
            forecast_date = current_date + timedelta(days=30 * i)
            month = forecast_date.month
            
            # Create feature vector for prediction
            feature_vector = [
                month / 12.0,
                np.sin(2 * np.pi * month / 12),
                np.cos(2 * np.pi * month / 12),
                np.mean([row.get('transaction_count', 0) for row in historical_data]) / 100.0,
                np.mean([row.get('avg_order_value', 0) for row in historical_data]) / 10000.0,
                1.0  # Future trend factor
            ]
            
            if self.is_fitted:
                feature_scaled = self.scaler.transform([feature_vector])
                predicted_revenue = self.model.predict(feature_scaled)[0]
                confidence = min(95, max(60, 90 - i * 5))  # Decreasing confidence
            else:
                # Fallback prediction
                avg_revenue = np.mean([row['total_sales'] for row in historical_data])
                seasonal_factor = self._get_seasonal_factor(month)
                predicted_revenue = avg_revenue * seasonal_factor
                confidence = 50
            
            forecasts.append({
                'month': forecast_date.strftime('%Y-%m'),
                'predicted_revenue': max(0, int(predicted_revenue)),
                'confidence': confidence,
                'factors': {
                    'seasonal': self._get_seasonal_factor(month),
                    'trend': 1.1,
                    'avg_order_value': np.mean([row.get('avg_order_value', 0) for row in historical_data]),
                    'market_conditions': 0.85
                }
            })
        
        return forecasts
    
    def _get_seasonal_factor(self, month):
        """Get seasonal factor for revenue prediction"""
        factors = {
            1: 1.1, 2: 1.0, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.3,
            7: 1.2, 8: 1.1, 9: 1.0, 10: 1.1, 11: 1.2, 12: 1.0
        }
        return factors.get(month, 1.0)
    
    def _generate_default_forecasts(self, months):
        """Generate default forecasts when insufficient data"""
        forecasts = []
        current_date = datetime.now()
        base_revenue = 150000  # Default base revenue
        
        for i in range(1, months + 1):
            forecast_date = current_date + timedelta(days=30 * i)
            month = forecast_date.month
            seasonal_factor = self._get_seasonal_factor(month)
            
            forecasts.append({
                'month': forecast_date.strftime('%Y-%m'),
                'predicted_revenue': int(base_revenue * seasonal_factor),
                'confidence': 60,
                'factors': {
                    'seasonal': seasonal_factor,
                    'trend': 1.0,
                    'avg_order_value': 2500,
                    'market_conditions': 0.85
                }
            })
        
        return forecasts

# Initialize ML models
seasonal_analyzer = SeasonalPatternAnalyzer()
revenue_forecaster = NeuralNetworkForecaster()

# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "Auto Parts ML Service",
        "version": "1.0.0",
        "algorithms": ["K-Nearest Neighbors (KNN)", "Neural Networks", "Statistical Analysis"]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Python ML Auto Parts Service",
        "algorithms": ["K-Nearest Neighbors (KNN)", "Neural Networks", "Statistical Analysis"],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/seasonal-patterns", response_model=SeasonalAnalysisResponse)
async def get_seasonal_patterns(months: int = 12):
    """KNN Seasonal Pattern Analysis endpoint"""
    try:
        logger.info(f"Starting KNN seasonal pattern analysis for {months} months")
        
        # Get historical sales data
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
        SELECT 
            EXTRACT(MONTH FROM m.inv_date) as month,
            COUNT(DISTINCT m.inv_master_id) as transaction_count,
            SUM(m.tot_amount) as total_sales,
            AVG(m.tot_amount) as avg_order_value,
            STDDEV(m.tot_amount) as sales_volatility,
            COUNT(DISTINCT d.itemcode) as unique_items_sold,
            SUM(d.qty) as total_quantity_sold
        FROM public.trn_invoice_master m
        LEFT JOIN public.trn_invoice_detail d ON m.inv_master_id = d.inv_master_id
        WHERE m.inv_date >= NOW() - INTERVAL '36 months'
        AND (m.is_deleted = false OR m.is_deleted IS NULL)
        GROUP BY EXTRACT(MONTH FROM m.inv_date)
        ORDER BY month
        """
        
        cursor.execute(query)
        historical_data = cursor.fetchall()
        
        # Convert to list of dicts
        historical_data = [dict(row) for row in historical_data]
        
        logger.info(f"Found {len(historical_data)} months of historical data")
        
        # Generate KNN-based seasonal analysis
        patterns = seasonal_analyzer.fit_and_predict(historical_data, months)
        
        # Calculate summary
        if patterns:
            peak_month = max(patterns, key=lambda x: x['predicted_seasonal_factor'])
            low_month = min(patterns, key=lambda x: x['predicted_seasonal_factor'])
            avg_confidence = sum(p['confidence'] for p in patterns) / len(patterns)
            seasonal_variation = peak_month['predicted_seasonal_factor'] - low_month['predicted_seasonal_factor']
        else:
            peak_month = {'month': 5, 'predicted_seasonal_factor': 1.4}
            low_month = {'month': 2, 'predicted_seasonal_factor': 1.0}
            avg_confidence = 65
            seasonal_variation = 0.4
        
        summary = {
            'peakMonth': {
                'month': peak_month['month'],
                'factor': peak_month['predicted_seasonal_factor'],
                'season': seasonal_analyzer._get_seasonal_insights(peak_month['month'])['season']
            },
            'lowMonth': {
                'month': low_month['month'],
                'factor': low_month['predicted_seasonal_factor'],
                'season': seasonal_analyzer._get_seasonal_insights(low_month['month'])['season']
            },
            'avgConfidence': int(avg_confidence),
            'seasonalVariation': round(seasonal_variation, 3),
            'volatility': 'High' if seasonal_variation > 0.5 else 'Medium' if seasonal_variation > 0.3 else 'Low'
        }
        
        # Business insights
        business_insights = {
            'inventoryPlanning': [
                {
                    'month': p['month'],
                    'monthName': datetime(2024, p['month'], 1).strftime('%B'),
                    'recommendedStockLevel': 'High' if p['predicted_seasonal_factor'] > 1.2 else 'Normal' if p['predicted_seasonal_factor'] > 0.9 else 'Low',
                    'keyProducts': p['seasonal_insights']['key_factors'],
                    'actionItems': p['seasonal_insights']['business_recommendations']
                }
                for p in patterns
            ],
            'seasonalStrategy': {
                'peakPreparation': f"Prepare for peak season in {summary['peakMonth']['season']} (Month {summary['peakMonth']['month']})",
                'lowSeasonOptimization': f"Optimize inventory during low season in {summary['lowMonth']['season']} (Month {summary['lowMonth']['month']})",
                'overallStrategy': 'High seasonal variation - implement dynamic inventory management' if summary['volatility'] == 'High' else 'Moderate seasonal variation - maintain flexible inventory levels'
            }
        }
        
        data_quality = {
            'monthsCovered': len(historical_data),
            'dataCompleteness': min(100, int((len(historical_data) / 12) * 100)),
            'recommendedAction': 'Collect more historical data for improved accuracy' if len(historical_data) < 12 else 'Sufficient data for reliable seasonal analysis'
        }
        
        cursor.close()
        conn.close()
        
        return SeasonalAnalysisResponse(
            patterns=patterns,
            summary=summary,
            algorithm="K-Nearest Neighbors (KNN)",
            business_value="Identify seasonal trends for auto parts inventory planning and sales optimization",
            business_insights=business_insights,
            data_quality=data_quality
        )
        
    except Exception as e:
        logger.error(f"Error in seasonal pattern analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/revenue-forecast", response_model=RevenueForecastResponse)
async def get_revenue_forecast(months: int = 6):
    """Neural Network Revenue Forecasting endpoint"""
    try:
        logger.info(f"Starting Neural Network revenue forecast for {months} months")
        
        # Get historical sales data
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
        SELECT 
            DATE_TRUNC('month', inv_date) as month,
            COUNT(*) as count,
            SUM(tot_amount) as total_sales,
            AVG(tot_amount) as avg_order_value
        FROM public.trn_invoice_master 
        WHERE inv_date >= NOW() - INTERVAL '24 months'
        AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY DATE_TRUNC('month', inv_date)
        ORDER BY month ASC
        """
        
        cursor.execute(query)
        historical_data = cursor.fetchall()
        
        # Convert to list of dicts
        historical_data = [
            {
                'month': row['month'].month,
                'total_sales': float(row['total_sales'] or 0),
                'count': int(row['count'] or 0),
                'avg_order_value': float(row['avg_order_value'] or 0)
            }
            for row in historical_data
        ]
        
        logger.info(f"Found {len(historical_data)} months of sales data")
        
        # Generate neural network forecast
        forecasts = revenue_forecaster.fit_and_predict(historical_data, months)
        
        # Calculate summary
        total_forecasted = sum(f['predicted_revenue'] for f in forecasts)
        avg_monthly = total_forecasted / len(forecasts) if forecasts else 0
        avg_confidence = sum(f['confidence'] for f in forecasts) / len(forecasts) if forecasts else 0
        
        # Calculate growth
        recent_revenue = historical_data[-1]['total_sales'] if historical_data else 0
        projected_growth = ((avg_monthly - recent_revenue) / recent_revenue * 100) if recent_revenue > 0 else 0
        
        summary = {
            'totalForecastedRevenue': int(total_forecasted),
            'avgMonthlyRevenue': int(avg_monthly),
            'avgConfidence': int(avg_confidence),
            'projectedGrowth': round(projected_growth, 1),
            'forecastPeriod': f"{months} months",
            'dataPoints': len(historical_data)
        }
        
        # Generate insights
        if forecasts:
            best_month = max(forecasts, key=lambda x: x['predicted_revenue'])
            worst_month = min(forecasts, key=lambda x: x['predicted_revenue'])
        else:
            best_month = worst_month = {'month': datetime.now().strftime('%Y-%m'), 'predicted_revenue': 0}
        
        insights = {
            'bestMonth': best_month,
            'worstMonth': worst_month,
            'trendDirection': 'Strong Growth' if projected_growth > 5 else 'Moderate Growth' if projected_growth > 0 else 'Stable' if projected_growth > -5 else 'Declining',
            'cashFlowImpact': 'Positive' if avg_monthly > recent_revenue else 'Negative'
        }
        
        cursor.close()
        conn.close()
        
        return RevenueForecastResponse(
            forecasts=forecasts,
            summary=summary,
            algorithm="Neural Networks (Multi-layer Perceptron)",
            business_value="Predict future sales revenue for cash flow planning and business decisions",
            insights=insights
        )
        
    except Exception as e:
        logger.error(f"Error in revenue forecasting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)