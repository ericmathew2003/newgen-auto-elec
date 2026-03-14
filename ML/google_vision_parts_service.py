#!/usr/bin/env python3
"""
Google Vision Enhanced Parts Identification Service
Combines Google Vision API with your trained model for better accuracy

Features:
1. Google Vision API for object detection and text recognition
2. Your trained model for specific part classification
3. Intelligent filtering to reject non-automotive content
4. Database integration with your inventory

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

# Google Vision API
try:
    from google.cloud import vision
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    print("Google Vision not available. Install with: pip install google-cloud-vision")
    GOOGLE_VISION_AVAILABLE = False

# ML libraries for your trained model
try:
    import tensorflow as tf
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    from tensorflow.keras.preprocessing import image as keras_image
    from tensorflow.keras.models import Model
    TF_AVAILABLE = True
except ImportError:
    print("TensorFlow not available. Install with: pip install tensorflow")
    TF_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Google Vision Enhanced Parts API",
    description="AI-powered parts identification using Google Vision + your trained model",
    version="5.0.0"
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

class GoogleVisionPartsService:
    def __init__(self):
        self.vision_client = None
        self.parts_classifier = None
        self.part_categories = []
        
        # Load your trained model categories
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
            logger.info(f"Loaded {len(self.part_categories)} categories from your trained model")
        else:
            logger.warning("class_indices.json not found")
            self.part_categories = ['oil_filter', 'air_filter', 'brake_pad', 'alternator', 'lights']
    
    def _initialize_google_vision(self):
        """Initialize Google Vision API client"""
        if GOOGLE_VISION_AVAILABLE:
            try:
                self.vision_client = vision.ImageAnnotatorClient()
                logger.info("✅ Google Vision API initialized")
            except Exception as e:
                logger.error(f"❌ Google Vision API failed: {e}")
                logger.info("Make sure you have set up Google Cloud credentials")
        else:
            logger.warning("❌ Google Vision API not available")
    
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
        """Analyze image using Google Vision API"""
        if not self.vision_client:
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
            
            # Text detection (for part numbers)
            text_response = self.vision_client.text_detection(image=image)
            texts = []
            
            if text_response.text_annotations:
                for text in text_response.text_annotations:
                    if len(text.description) > 2:  # Filter out single characters
                        texts.append({
                            'text': text.description,
                            'confidence': 1.0  # Google doesn't provide text confidence
                        })
            
            logger.info(f"Google Vision found {len(objects)} objects and {len(texts)} text elements")
            
            return {
                'objects': objects,
                'texts': texts,
                'available': True
            }
        
        except Exception as e:
            logger.error(f"Google Vision API error: {e}")
            return {'objects': [], 'texts': [], 'available': False, 'error': str(e)}
    
    def categorize_google_object(self, object_name: str) -> str:
        """Categorize Google Vision objects as automotive or non-automotive"""
        object_name_lower = object_name.lower()
        
        # Automotive-related objects
        automotive_keywords = [
            'car', 'vehicle', 'auto', 'motor', 'engine', 'wheel', 'tire', 'brake',
            'filter', 'battery', 'alternator', 'radiator', 'transmission', 'clutch',
            'suspension', 'exhaust', 'headlight', 'taillight', 'bumper', 'hood',
            'mechanical', 'metal', 'cylinder', 'gear', 'bearing', 'gasket'
        ]
        
        # Non-automotive objects
        non_automotive_keywords = [
            'person', 'human', 'face', 'animal', 'cat', 'dog', 'food', 'fruit',
            'furniture', 'chair', 'table', 'book', 'pen', 'pencil', 'clothing',
            'shirt', 'hat', 'building', 'house', 'tree', 'plant', 'sky', 'cloud'
        ]
        
        # Check for automotive keywords
        for keyword in automotive_keywords:
            if keyword in object_name_lower:
                return 'automotive'
        
        # Check for non-automotive keywords
        for keyword in non_automotive_keywords:
            if keyword in object_name_lower:
                return 'non_automotive'
        
        return 'unknown'
    
    def classify_with_your_model(self, image_data: bytes) -> Tuple[str, float]:
        """Classify using your trained model"""
        if not self.parts_classifier:
            return "unknown", 0.0
        
        try:
            # Preprocess image (same as your original service)
            img = Image.open(io.BytesIO(image_data))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = img.resize((224, 224))
            img_array = keras_image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)
            
            # Make prediction
            predictions = self.parts_classifier.predict(img_array, verbose=0)
            predicted_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_idx])
            
            if predicted_idx < len(self.part_categories):
                category = self.part_categories[predicted_idx]
            else:
                category = "unknown"
            
            logger.info(f"Your model classified as: {category} (confidence: {confidence:.3f})")
            return category, confidence
        
        except Exception as e:
            logger.error(f"Error in your model classification: {e}")
            return "unknown", 0.0
    
    def extract_part_numbers(self, texts: List[Dict]) -> List[str]:
        """Extract part numbers from Google Vision text results"""
        part_numbers = []
        
        # Part number patterns
        patterns = [
            r'\d{5,}[A-Z]*\d*',     # 16510M79F00
            r'[A-Z]{2,}\d{4,}',      # ABC12345
            r'\d{4,}-\d{2,}',        # 1234-56
            r'[A-Z]\d{4}[A-Z]{2}\d{3}' # A1234BC567
        ]
        
        for text_obj in texts:
            text = text_obj['text'].upper()
            clean_text = re.sub(r'[^A-Z0-9-]', '', text)
            
            for pattern in patterns:
                matches = re.findall(pattern, clean_text)
                part_numbers.extend(matches)
        
        return list(set(part_numbers))  # Remove duplicates
    
    def intelligent_filtering(self, google_result: Dict, your_category: str, your_confidence: float) -> Dict:
        """Intelligent filtering using both Google Vision and your model"""
        
        # If Google Vision is not available, use your model only
        if not google_result['available']:
            if your_confidence < 0.3:
                return {
                    'is_automotive': False,
                    'reason': 'low_confidence_no_google',
                    'message': f'Your model has low confidence ({your_confidence:.2f}) and Google Vision is not available'
                }
            return {'is_automotive': True, 'reason': 'your_model_only'}
        
        # Analyze Google Vision results
        automotive_objects = [obj for obj in google_result['objects'] if obj['category'] == 'automotive']
        non_automotive_objects = [obj for obj in google_result['objects'] if obj['category'] == 'non_automotive']
        
        # Decision logic
        if non_automotive_objects and not automotive_objects:
            # Google clearly sees non-automotive objects
            highest_non_auto = max(non_automotive_objects, key=lambda x: x['confidence'])
            if highest_non_auto['confidence'] > 0.7:
                return {
                    'is_automotive': False,
                    'reason': 'google_non_automotive',
                    'message': f'Google Vision detected {highest_non_auto["name"]} with {highest_non_auto["confidence"]:.2f} confidence'
                }
        
        if automotive_objects:
            # Google sees automotive objects
            return {'is_automotive': True, 'reason': 'google_automotive'}
        
        # If Google is uncertain, rely on your model
        if your_confidence > 0.6:
            return {'is_automotive': True, 'reason': 'your_model_confident'}
        
        # Both are uncertain - be cautious
        return {
            'is_automotive': False,
            'reason': 'both_uncertain',
            'message': f'Both Google Vision and your model are uncertain. Your model confidence: {your_confidence:.2f}'
        }
    
    def search_inventory(self, category: str, part_numbers: List[str]) -> List[Dict]:
        """Search inventory using category and part numbers"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT 
                    i.itemcode,
                    i.itemname,
                    i.suppref as part_number,
                    g.groupname as category,
                    m.makename as car_make,
                    b.brandname as brand,
                    i.sprice,
                    i.curstock
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE i.deleted = false
            """
            
            params = []
            
            # Filter by category
            if category and category != 'unknown':
                query += " AND LOWER(g.groupname) LIKE LOWER(%s)"
                params.append(f'%{category}%')
            
            # Filter by part numbers
            if part_numbers:
                pn_conditions = []
                for pn in part_numbers:
                    pn_conditions.append("UPPER(i.suppref) LIKE %s OR UPPER(i.itemname) LIKE %s")
                    params.extend([f'%{pn}%', f'%{pn}%'])
                if pn_conditions:
                    query += f" AND ({' OR '.join(pn_conditions)})"
            
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
        """Main identification method using Google Vision + your model"""
        
        # Step 1: Analyze with Google Vision
        google_result = self.analyze_with_google_vision(image_data)
        
        # Step 2: Classify with your trained model
        your_category, your_confidence = self.classify_with_your_model(image_data)
        
        # Step 3: Intelligent filtering
        filter_result = self.intelligent_filtering(google_result, your_category, your_confidence)
        
        if not filter_result['is_automotive']:
            return {
                'success': False,
                'reason': filter_result['reason'],
                'message': filter_result.get('message', 'This does not appear to be an automotive part'),
                'google_objects': google_result.get('objects', []),
                'your_classification': {
                    'category': your_category,
                    'confidence': your_confidence
                }
            }
        
        # Step 4: Extract part numbers from Google Vision text
        part_numbers = self.extract_part_numbers(google_result.get('texts', []))
        
        # Step 5: Search inventory
        inventory_matches = self.search_inventory(your_category, part_numbers)
        
        return {
            'success': True,
            'google_vision': {
                'objects': google_result.get('objects', []),
                'texts': google_result.get('texts', []),
                'available': google_result.get('available', False)
            },
            'your_model': {
                'category': your_category,
                'confidence': your_confidence
            },
            'extracted_part_numbers': part_numbers,
            'inventory_matches': inventory_matches,
            'match_count': len(inventory_matches),
            'filter_reason': filter_result['reason']
        }

# Initialize service
vision_service = GoogleVisionPartsService()

# API Endpoints

@app.get("/")
async def root():
    return {
        "service": "Google Vision Enhanced Parts API",
        "version": "5.0.0",
        "description": "Combines Google Vision API with your trained model",
        "capabilities": {
            "google_vision": GOOGLE_VISION_AVAILABLE,
            "your_trained_model": vision_service.parts_classifier is not None,
            "database_search": get_db() is not None
        },
        "categories": len(vision_service.part_categories)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "google_vision": "✅" if GOOGLE_VISION_AVAILABLE else "❌",
        "your_model": "✅" if vision_service.parts_classifier else "❌",
        "database": "✅" if get_db() else "❌"
    }

@app.post("/identify")
async def identify_part(file: UploadFile = File(...)):
    """Enhanced part identification using Google Vision + your model"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        result = vision_service.identify_part(image_data)
        
        return {
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            **result
        }
    
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/google-only")
async def google_vision_only(file: UploadFile = File(...)):
    """Test Google Vision API only"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        result = vision_service.analyze_with_google_vision(image_data)
        
        return result
    
    except Exception as e:
        logger.error(f"Error in Google Vision: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔍 GOOGLE VISION ENHANCED PARTS SERVICE")
    print("="*70)
    print("🌐 Google Vision API:", "✅" if GOOGLE_VISION_AVAILABLE else "❌")
    print("🤖 Your Trained Model:", "✅" if vision_service.parts_classifier else "❌")
    print("💾 Database:", "✅" if get_db() else "❌")
    print(f"📂 Categories: {len(vision_service.part_categories)}")
    print("="*70)
    print("🌐 Server: http://localhost:8006")
    print("📖 Docs: http://localhost:8006/docs")
    print("="*70)
    print("\n🚀 ENHANCED FEATURES:")
    print("✅ Google Vision object detection")
    print("✅ Google Vision text recognition (part numbers)")
    print("✅ Your trained model for specific classification")
    print("✅ Intelligent filtering combining both")
    print("✅ Better accuracy for automotive vs non-automotive")
    print("="*70 + "\n")
    
    uvicorn.run(
        "google_vision_parts_service:app",
        host="0.0.0.0",
        port=8006,
        reload=True
    )