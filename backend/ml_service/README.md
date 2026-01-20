# Python ML Service for Auto Parts Business Intelligence

This Python-based ML service provides advanced machine learning capabilities for your auto parts business, including seasonal pattern analysis and revenue forecasting.

## Features

### 🔍 **K-Nearest Neighbors (KNN) Seasonal Analysis**
- Advanced seasonal pattern recognition using scikit-learn
- Identifies optimal inventory levels by season
- Provides business recommendations for each month
- Analyzes temperature, rainfall, holiday, and economic factors

### 🧠 **Neural Network Revenue Forecasting**
- Multi-layer perceptron for revenue prediction
- Uses historical sales data for training
- Provides confidence intervals for predictions
- Seasonal trend analysis and cash flow insights

### 📊 **Enhanced Data Processing**
- Pandas for efficient data manipulation
- NumPy for numerical computations
- PostgreSQL integration with real-time data
- Standardized feature scaling and normalization

## Installation

### 1. Install Python Dependencies
```bash
cd backend/ml_service
pip install -r requirements.txt
```

### 2. Set Up Environment Variables
Copy the `.env` file and update with your database credentials:
```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=newgen
DB_USER=postgres
DB_PASSWORD=admin
```

### 3. Run the ML Service
```bash
python main.py
```

The service will start on `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Seasonal Pattern Analysis
```
GET /seasonal-patterns?months=12
```
**Response:**
```json
{
  "patterns": [
    {
      "month": 1,
      "predicted_seasonal_factor": 1.1,
      "confidence": 85,
      "seasonal_insights": {
        "season": "Winter",
        "seasonal_trend": "Winter maintenance peak - batteries, heaters, antifreeze",
        "key_factors": ["Winter conditions increase battery and heating demand"],
        "business_recommendations": ["Focus on winter maintenance items"]
      }
    }
  ],
  "summary": {
    "peakMonth": {"month": 5, "factor": 1.4, "season": "Spring"},
    "lowMonth": {"month": 2, "factor": 1.0, "season": "Winter"},
    "avgConfidence": 85,
    "seasonalVariation": 0.4,
    "volatility": "Medium"
  },
  "algorithm": "K-Nearest Neighbors (KNN)",
  "business_value": "Identify seasonal trends for auto parts inventory planning"
}
```

### Revenue Forecasting
```
GET /revenue-forecast?months=6
```
**Response:**
```json
{
  "forecasts": [
    {
      "month": "2024-11",
      "predicted_revenue": 185000,
      "confidence": 90,
      "factors": {
        "seasonal": 1.2,
        "trend": 1.1,
        "avg_order_value": 2500,
        "market_conditions": 0.85
      }
    }
  ],
  "summary": {
    "totalForecastedRevenue": 1100000,
    "avgMonthlyRevenue": 183333,
    "avgConfidence": 85,
    "projectedGrowth": 8.5,
    "forecastPeriod": "6 months"
  },
  "algorithm": "Neural Networks (Multi-layer Perceptron)"
}
```

## Integration with Node.js Backend

### Update your Node.js ML routes to proxy to Python service:

```javascript
// In backend/routes/mlRoutes.js
const axios = require('axios');

const PYTHON_ML_SERVICE = 'http://localhost:8000';

router.get("/seasonal-patterns", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_ML_SERVICE}/seasonal-patterns`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    console.error('Python ML service error:', error);
    res.status(500).json({ error: 'ML service unavailable' });
  }
});

router.get("/revenue-forecast", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_ML_SERVICE}/revenue-forecast`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    console.error('Python ML service error:', error);
    res.status(500).json({ error: 'ML service unavailable' });
  }
});
```

## Advantages of Python ML Service

### 🚀 **Performance Benefits**
- **Scikit-learn**: Industry-standard ML library with optimized algorithms
- **NumPy/Pandas**: Efficient numerical computations and data processing
- **Better Memory Management**: Handles large datasets more efficiently
- **Parallel Processing**: Built-in support for multi-threading

### 🔬 **Advanced ML Capabilities**
- **More Algorithms**: Access to 100+ ML algorithms in scikit-learn
- **Feature Engineering**: Advanced preprocessing and feature selection
- **Model Validation**: Cross-validation, hyperparameter tuning
- **Ensemble Methods**: Random Forest, Gradient Boosting, etc.

### 📈 **Scalability**
- **FastAPI**: High-performance async web framework
- **Horizontal Scaling**: Easy to deploy multiple instances
- **GPU Support**: Can integrate TensorFlow/PyTorch for deep learning
- **Caching**: Redis integration for model caching

### 🛠 **Development Benefits**
- **Rich Ecosystem**: Matplotlib, Seaborn for visualization
- **Jupyter Notebooks**: Interactive development and analysis
- **Testing**: Comprehensive testing frameworks
- **Documentation**: Automatic API documentation with FastAPI

## Future Enhancements

1. **Deep Learning Models**: LSTM for time series forecasting
2. **Clustering Analysis**: Customer segmentation
3. **Anomaly Detection**: Fraud detection and outlier identification
4. **Recommendation Engine**: Product recommendation system
5. **Real-time Predictions**: WebSocket support for live updates

## Monitoring and Logging

The service includes comprehensive logging and can be integrated with:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **ELK Stack**: Centralized logging
- **Sentry**: Error tracking

## Deployment

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Considerations
- Use Gunicorn with multiple workers
- Set up reverse proxy with Nginx
- Configure SSL certificates
- Implement rate limiting
- Set up health checks and monitoring