// Node.js proxy routes for Python ML Service
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Python ML Service Configuration
const PYTHON_ML_SERVICE = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:8000';

// Helper function to handle ML service requests
async function callPythonMLService(endpoint, params = {}) {
  try {
    console.log(`🐍 Calling Python ML service: ${endpoint}`);
    const response = await axios.get(`${PYTHON_ML_SERVICE}${endpoint}`, {
      params,
      timeout: 30000 // 30 second timeout
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Python ML service error for ${endpoint}:`, error.message);
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Python ML service is not running. Please start it with: cd backend/ml_service && python run.py');
    }
    
    throw new Error(`ML service error: ${error.message}`);
  }
}

// Health check for Python ML service
router.get("/python-health", async (req, res) => {
  try {
    const health = await callPythonMLService('/health');
    res.json({
      status: 'connected',
      python_service: health,
      proxy_status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
      proxy_status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// KNN Seasonal Pattern Analysis (Python-powered)
router.get("/seasonal-patterns-python", async (req, res) => {
  try {
    const { months = 12 } = req.query;
    
    console.log('🔍 Starting Python KNN seasonal pattern analysis...');
    
    const result = await callPythonMLService('/seasonal-patterns', { months });
    
    console.log(`✅ Python KNN analysis completed for ${months} months`);
    
    res.json({
      ...result,
      source: 'Python ML Service',
      enhanced_features: [
        'Scikit-learn KNN implementation',
        'Advanced feature engineering',
        'Statistical confidence intervals',
        'Optimized performance'
      ],
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error in Python seasonal analysis:", error);
    res.status(500).json({ 
      error: "Failed to get seasonal patterns from Python ML service",
      details: error.message,
      fallback_available: true,
      suggestion: "Try the Node.js implementation at /api/ml/seasonal-patterns"
    });
  }
});

// Neural Network Revenue Forecasting (Python-powered)
router.get("/revenue-forecast-python", async (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    console.log('🧠 Starting Python Neural Network revenue forecast...');
    
    const result = await callPythonMLService('/revenue-forecast', { months });
    
    console.log(`✅ Python Neural Network forecast completed for ${months} months`);
    
    res.json({
      ...result,
      source: 'Python ML Service',
      enhanced_features: [
        'Scikit-learn Multi-layer Perceptron',
        'Advanced preprocessing',
        'Feature scaling and normalization',
        'Cross-validation ready'
      ],
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error in Python revenue forecasting:", error);
    res.status(500).json({ 
      error: "Failed to get revenue forecast from Python ML service",
      details: error.message,
      fallback_available: true,
      suggestion: "Try the Node.js implementation at /api/ml/revenue-forecast"
    });
  }
});

// ML Service Comparison endpoint
router.get("/compare-services", async (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    console.log('🔄 Comparing Node.js vs Python ML services...');
    
    // Get results from both services
    const [pythonResult, nodeResult] = await Promise.allSettled([
      callPythonMLService('/seasonal-patterns', { months }),
      // You would call your Node.js implementation here
      // For now, we'll simulate it
      Promise.resolve({ 
        algorithm: 'Node.js KNN Implementation',
        patterns: [],
        summary: { note: 'Node.js implementation results would go here' }
      })
    ]);
    
    const comparison = {
      python_service: {
        status: pythonResult.status,
        data: pythonResult.status === 'fulfilled' ? pythonResult.value : null,
        error: pythonResult.status === 'rejected' ? pythonResult.reason.message : null,
        advantages: [
          'Scikit-learn optimized algorithms',
          'Better performance for large datasets',
          'Advanced statistical methods',
          'Rich ML ecosystem'
        ]
      },
      nodejs_service: {
        status: nodeResult.status,
        data: nodeResult.status === 'fulfilled' ? nodeResult.value : null,
        error: nodeResult.status === 'rejected' ? nodeResult.reason.message : null,
        advantages: [
          'No additional service dependency',
          'Integrated with existing codebase',
          'Simpler deployment',
          'Direct database access'
        ]
      },
      recommendation: pythonResult.status === 'fulfilled' ? 
        'Use Python service for production - better performance and accuracy' :
        'Use Node.js service as fallback - more reliable for current setup',
      timestamp: new Date().toISOString()
    };
    
    res.json(comparison);
    
  } catch (error) {
    console.error("Error comparing ML services:", error);
    res.status(500).json({ 
      error: "Failed to compare ML services",
      details: error.message
    });
  }
});

// Service status and configuration
router.get("/python-status", async (req, res) => {
  try {
    const status = await callPythonMLService('/');
    
    res.json({
      python_ml_service: {
        url: PYTHON_ML_SERVICE,
        status: 'connected',
        info: status,
        endpoints: [
          `${PYTHON_ML_SERVICE}/seasonal-patterns`,
          `${PYTHON_ML_SERVICE}/revenue-forecast`,
          `${PYTHON_ML_SERVICE}/health`,
          `${PYTHON_ML_SERVICE}/docs` // FastAPI auto-generated docs
        ]
      },
      integration: {
        proxy_routes: [
          '/api/ml/seasonal-patterns-python',
          '/api/ml/revenue-forecast-python',
          '/api/ml/python-health',
          '/api/ml/compare-services'
        ],
        fallback_routes: [
          '/api/ml/seasonal-patterns (Node.js)',
          '/api/ml/revenue-forecast (Node.js)'
        ]
      },
      setup_instructions: {
        start_python_service: 'cd backend/ml_service && python run.py',
        install_dependencies: 'cd backend/ml_service && pip install -r requirements.txt',
        view_api_docs: `${PYTHON_ML_SERVICE}/docs`
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(503).json({
      python_ml_service: {
        url: PYTHON_ML_SERVICE,
        status: 'disconnected',
        error: error.message
      },
      setup_required: true,
      instructions: [
        '1. Install Python dependencies: cd backend/ml_service && pip install -r requirements.txt',
        '2. Start Python ML service: cd backend/ml_service && python run.py',
        '3. Verify service is running: curl http://localhost:8000/health'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;