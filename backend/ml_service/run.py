#!/usr/bin/env python3
"""
Auto Parts ML Service Runner
Simple script to start the ML service with proper configuration
"""

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Configuration
    host = os.getenv('ML_SERVICE_HOST', '0.0.0.0')
    port = int(os.getenv('ML_SERVICE_PORT', 8000))
    
    print(f"🚀 Starting Auto Parts ML Service...")
    print(f"📡 Host: {host}")
    print(f"🔌 Port: {port}")
    print(f"📊 Algorithms: KNN Seasonal Analysis, Neural Network Revenue Forecasting")
    print(f"🌐 API Documentation: http://{host}:{port}/docs")
    print(f"❤️  Health Check: http://{host}:{port}/health")
    
    # Start the service
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,  # Enable auto-reload for development
        log_level="info"
    )