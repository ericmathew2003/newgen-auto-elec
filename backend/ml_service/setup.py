#!/usr/bin/env python3
"""
Setup script for Auto Parts ML Service
Checks dependencies and database connectivity
"""

import sys
import subprocess
import os
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        return False
    print(f"✅ Python version: {sys.version}")
    return True

def install_dependencies():
    """Install required Python packages"""
    print("\n📦 Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def check_database_connection():
    """Test database connectivity"""
    print("\n🔌 Testing database connection...")
    try:
        import psycopg2
        from dotenv import load_dotenv
        
        load_dotenv()
        
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'newgen'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'admin')
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM public.trn_invoice_master")
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        print(f"✅ Database connected successfully")
        print(f"   Found {count} invoice records")
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("   Please check your database configuration in .env file")
        return False

def test_ml_functionality():
    """Test basic ML functionality"""
    print("\n🧠 Testing ML functionality...")
    try:
        import numpy as np
        import pandas as pd
        from sklearn.neighbors import KNeighborsRegressor
        from sklearn.neural_network import MLPRegressor
        
        # Test basic ML operations
        X = np.random.rand(10, 3)
        y = np.random.rand(10)
        
        # Test KNN
        knn = KNeighborsRegressor(n_neighbors=3)
        knn.fit(X, y)
        knn_pred = knn.predict(X[:1])
        
        # Test Neural Network
        nn = MLPRegressor(hidden_layer_sizes=(5,), max_iter=100, random_state=42)
        nn.fit(X, y)
        nn_pred = nn.predict(X[:1])
        
        print("✅ ML libraries working correctly")
        print(f"   KNN prediction: {knn_pred[0]:.3f}")
        print(f"   Neural Network prediction: {nn_pred[0]:.3f}")
        return True
        
    except Exception as e:
        print(f"❌ ML functionality test failed: {e}")
        return False

def create_sample_data():
    """Create sample data for testing if database is empty"""
    print("\n📊 Checking for sample data...")
    try:
        import psycopg2
        from dotenv import load_dotenv
        from datetime import datetime, timedelta
        import random
        
        load_dotenv()
        
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'newgen'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'admin')
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM public.trn_invoice_master")
        count = cursor.fetchone()[0]
        
        if count < 10:
            print(f"   Only {count} records found. Consider adding more sample data for better ML results.")
            print("   The ML service will work with default patterns if insufficient data is available.")
        else:
            print(f"✅ Sufficient data found: {count} invoice records")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"⚠️  Could not check sample data: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Auto Parts ML Service Setup")
    print("=" * 50)
    
    success = True
    
    # Check Python version
    if not check_python_version():
        success = False
    
    # Install dependencies
    if success and not install_dependencies():
        success = False
    
    # Test database connection
    if success and not check_database_connection():
        success = False
    
    # Test ML functionality
    if success and not test_ml_functionality():
        success = False
    
    # Check sample data
    if success:
        create_sample_data()
    
    print("\n" + "=" * 50)
    
    if success:
        print("✅ Setup completed successfully!")
        print("\n🚀 To start the ML service:")
        print("   python run.py")
        print("\n📚 API Documentation:")
        print("   http://localhost:8000/docs")
        print("\n🔗 Integration endpoints:")
        print("   http://localhost:5000/api/ml/python-status")
        print("   http://localhost:5000/api/ml/seasonal-patterns-python")
        print("   http://localhost:5000/api/ml/revenue-forecast-python")
    else:
        print("❌ Setup failed. Please fix the issues above and try again.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())