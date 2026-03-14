#!/usr/bin/env python3
"""
Hybrid Parts Vision Service
Works with or without Google Vision API
Falls back gracefully when Google Vision is not available

Features:
1. Google Vision API (when available)
2. Your trained model (always available)
3. Intelligent filtering
4. Database integration

Author: AI Assistant
Date: 2024
"""

import os
import io
import re
import json
import numpy as np
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

# FastAPI
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Database
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Image processing
from PIL import Image
import cv2

# Google Vision API (optional)
try:
    from google.cloud import vision
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    GOOGLE_VISION_AVAILABLE = False

# ML libraries for your trained model
try:
    import tensorflow as tf
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    from tensorflow.keras.preprocessing import image as keras_image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hybrid Parts Vision API",
    description="Smart parts identification with optional Google Vision enhancement",
    version="6.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    try:
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'newgen'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'admin')
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

class HybridPartsService:
    def __init__(self):
        self.vision_client = None
        self.parts_classifier = None
        self.part_categories = []
        self.google_vision_enabled = False
        
        # Load categories
        self.load_part_categories()
        
        # Initialize services
        self._initialize_google_vision()
        self._initialize_parts_classifier()
    
    def load_part_categories(self):
        """Load part categories from your trained model"""
        class_indices_path = 'ML/models/class_indices.json'
        if os.path.exists(class_indices_path):
            with open(class_indices_path, 'r') as f:
                class_indices = json.load(f)
            self.part_categories = [k for k, v in sorted(class_indices.items(), key=lambda x: x[1])]
            logger.info(f"Loaded {len(self.part_categories)} categories")
        else:
            self.part_categories = ['oil_filter', 'air_filter', 'brake_pad', 'alternator', 'lights']
    
    def _initialize_google_vision(self):
        """Initialize Google Vision API client (optional)"""
        if not GOOGLE_VISION_AVAILABLE:
            logger.info("📝 Google Vision library not available")
            return
        
        try:
            # Check if credentials are set
            if not os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
                logger.info("📝 Google Vision credentials not set (optional)")
                return
            
            self.vision_client = vision.ImageAnnotatorClient()
            self.google_vision_enabled = True
            logger.info("✅ Google Vision API initialized")
        except Exception as e:
            logger.info(f"📝 Google Vision API not available: {e}")
    
    def _initialize_parts_classifier(self):
        """Load your trained parts classification model"""
        if not TF_AVAILABLE:
            return
        
        model_paths = [
            'ML/models/parts_classifier.h5',
            'models/parts_classifier.h5'
        ]
        
        for model_path in model_paths:
            if os.path.exists(model_path):
                try:
                    self.parts_classifier = tf.keras.models.load_model(model_path)
                    logger.info(f"✅ Your trained model loaded from {model_path}")
                    return
                except Exception as e:
                    logger.warning(f"Failed to load {model_path}: {e}")
        
        logger.warning("❌ Could not load your trained model")
    
    def analyze_with_google_vision(self, image_data: bytes) -> Dict:
        """Analyze image using Google Vision API (if available)"""
        if not self.google_vision_enabled:
            return {'objects': [], 'texts': [], 'available': False}
        
        try:
            image = vision.Image(content=image_data)
            
            # Object detection
            objects_response = self.vision_client.object_localization(image=image)
            objects = []
            
            for obj in objects_response.localized_object_annotations:
                objects.append({
                    'name': obj.name,
                    'confidence': obj.score,
                    'category': self.categorize_google_object(obj.name)
                })
            
            # Text detection
            text_response = self.vision_client.text_detection(image=image)
            texts = []
            
            if text_response.text_annotations:
                for text in text_response.text_annotations:
                    if len(text.description) > 2:
                        texts.append({
                            'text': text.description,
                            'confidence': 1.0
                        })
            
            logger.info(f"Google Vision: {len(objects)} objects, {len(texts)} texts")
            
            return {
                'objects': objects,
                'texts': texts,
                'available': True
            }
        
        except Exception as e:
            logger.error(f"Google Vision error: {e}")
            return {'objects': [], 'texts': [], 'available': False, 'error': str(e)}
    
    def categorize_google_object(self, object_name: str) -> str:
        """Categorize Google Vision objects"""
        object_name_lower = object_name.lower()
        
        # Automotive keywords
        automotive_keywords = [
            'car', 'vehicle', 'auto', 'motor', 'engine', 'wheel', 'tire', 'brake',
            'filter', 'battery', 'alternator', 'radiator', 'transmission', 'clutch',
            'cylinder', 'metal', 'gear', 'bearing', 'mechanical'
        ]
        
        # Non-automotive keywords
        non_automotive_keywords = [
            'person', 'human', 'face', 'animal', 'cat', 'dog', 'food', 'fruit',
            'furniture', 'chair', 'table', 'book', 'pen', 'clothing', 'building'
        ]
        
        for keyword in automotive_keywords:
            if keyword in object_name_lower:
                return 'automotive'
        
        for keyword in non_automotive_keywords:
            if keyword in object_name_lower:
                return 'non_automotive'
        
        return 'unknown'
    
    def classify_with_your_model(self, image_data: bytes) -> Tuple[str, float]:
        """Classify using your trained model"""
        if not self.parts_classifier:
            return "unknown", 0.0
        
        try:
            # Preprocess image (same as original)
            img = Image.open(io.BytesIO(image_data))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = img.resize((224, 224))
            img_array = keras_image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)
            
            # Predict
            predictions = self.parts_classifier.predict(img_array, verbose=0)
            predicted_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_idx])
            
            if predicted_idx < len(self.part_categories):
                category = self.part_categories[predicted_idx]
            else:
                category = "unknown"
            
            logger.info(f"Your model: {category} (confidence: {confidence:.3f})")
            return category, confidence
        
        except Exception as e:
            logger.error(f"Model classification error: {e}")
            return "unknown", 0.0
    
    def smart_filtering(self, google_result: Dict, your_category: str, your_confidence: float) -> Dict:
        """Smart filtering using available information"""
        
        # If Google Vision is available, use it for filtering
        if google_result['available']:
            non_automotive_objects = [obj for obj in google_result['objects'] 
                                    if obj['category'] == 'non_automotive']
            
            # If Google clearly sees non-automotive objects with high confidence
            if non_automotive_objects:
                highest_non_auto = max(non_automotive_objects, key=lambda x: x['confidence'])
                if highest_non_auto['confidence'] > 0.8:
                    return {
                        'is_automotive': False,
                        'reason': 'google_non_automotive',
                        'message': f'Google Vision detected {highest_non_auto["name"]} with high confidence'
                    }
            
            # If Google sees automotive objects, allow through
            automotive_objects = [obj for obj in google_result['objects'] 
                                if obj['category'] == 'automotive']
            if automotive_objects:
                return {'is_automotive': True, 'reason': 'google_automotive'}
        
        # Fallback to your model confidence
        if your_confidence < 0.3:
            return {
                'is_automotive': False,
                'reason': 'low_model_confidence',
                'message': f'Low classification confidence ({your_confidence:.2f})'
            }
        
        # Special case: "lights" with medium confidence might be anime/artistic
        if your_category == 'lights' and your_confidence < 0.9:
            return {
                'is_automotive': False,
                'reason': 'suspicious_lights',
                'message': f'Suspicious lights classification (confidence: {your_confidence:.2f}). May be artistic content with lighting effects.'
            }
        
        return {'is_automotive': True, 'reason': 'model_confident'}
    
    def search_inventory(self, category: str, part_numbers: List[str] = None) -> List[Dict]:
        """Search inventory"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT 
                    i.itemcode, i.itemname, i.suppref as part_number,
                    g.groupname as category, m.makename as car_make,
                    b.brandname as brand, i.sprice, i.curstock
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE i.deleted = false
            """
            
            params = []
            
            if category and category != 'unknown':
                query += " AND LOWER(g.groupname) LIKE LOWER(%s)"
                params.append(f'%{category}%')
            
            query += " ORDER BY i.curstock DESC LIMIT 10"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            matches = []
            for row in results:
                matches.append({
                    'item_code': row['itemcode'],
                    'item_name': row['itemname'],
                    'part_number': row['part_number'],
                    'category': row['category'],
                    'car_make': row['car_make'],
                    'brand': row['brand'],
                    'price': float(row['sprice'] or 0),
                    'stock': float(row['curstock'] or 0)
                })
            
            cursor.close()
            conn.close()
            return matches
        
        except Exception as e:
            logger.error(f"Inventory search error: {e}")
            if conn:
                conn.close()
            return []
    
    def identify_part(self, image_data: bytes) -> Dict:
        """Main identification method"""
        
        # Step 1: Analyze with Google Vision (if available)
        google_result = self.analyze_with_google_vision(image_data)
        
        # Step 2: Classify with your model
        your_category, your_confidence = self.classify_with_your_model(image_data)
        
        # Step 3: Smart filtering
        filter_result = self.smart_filtering(google_result, your_category, your_confidence)
        
        if not filter_result['is_automotive']:
            return {
                'success': False,
                'reason': filter_result['reason'],
                'message': filter_result.get('message', 'Not an automotive part'),
                'google_available': google_result['available'],
                'your_classification': {
                    'category': your_category,
                    'confidence': your_confidence
                }
            }
        
        # Step 4: Search inventory
        inventory_matches = self.search_inventory(your_category)
        
        return {
            'success': True,
            'google_vision': {
                'available': google_result['available'],
                'objects': google_result.get('objects', []),
                'texts': google_result.get('texts', [])
            },
            'your_model': {
                'category': your_category,
                'confidence': your_confidence
            },
            'inventory_matches': inventory_matches,
            'match_count': len(inventory_matches),
            'filter_reason': filter_result['reason']
        }

# Initialize service
hybrid_service = HybridPartsService()

@app.get("/")
async def root():
    return {
        "service": "Hybrid Parts Vision API",
        "version": "6.0.0",
        "description": "Smart parts identification with optional Google Vision",
        "status": {
            "google_vision": hybrid_service.google_vision_enabled,
            "your_model": hybrid_service.parts_classifier is not None,
            "database": get_db() is not None
        },
        "categories": len(hybrid_service.part_categories)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "google_vision": "✅" if hybrid_service.google_vision_enabled else "📝 Optional",
        "your_model": "✅" if hybrid_service.parts_classifier else "❌",
        "database": "✅" if get_db() else "❌"
    }

@app.post("/identify")
async def identify_part(file: UploadFile = File(...)):
    """Smart part identification"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        result = hybrid_service.identify_part(image_data)
        
        return {
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            **result
        }
    
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔧 HYBRID PARTS VISION SERVICE")
    print("="*70)
    print("🌐 Google Vision:", "✅ Enabled" if hybrid_service.google_vision_enabled else "📝 Optional (not configured)")
    print("🤖 Your Model:", "✅" if hybrid_service.parts_classifier else "❌")
    print("💾 Database:", "✅" if get_db() else "❌")
    print(f"📂 Categories: {len(hybrid_service.part_categories)}")
    print("="*70)
    print("🌐 Server: http://localhost:8007")
    print("📖 Docs: http://localhost:8007/docs")
    print("="*70)
    print("\n💡 SMART FEATURES:")
    print("✅ Works with or without Google Vision")
    print("✅ Better filtering for anime/artistic content")
    print("✅ Improved confidence thresholds")
    print("✅ Graceful fallback when services unavailable")
    if not hybrid_service.google_vision_enabled:
        print("\n📝 To enable Google Vision:")
        print("1. Set up Google Cloud credentials")
        print("2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        print("3. Restart the service")
    print("="*70 + "\n")
    
    uvicorn.run(
        "hybrid_parts_service:app",
        host="0.0.0.0",
        port=8007,
        reload=True
    )