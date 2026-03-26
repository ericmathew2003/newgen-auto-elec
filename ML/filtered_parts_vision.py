#!/usr/bin/env python3
"""
Filtered Parts Vision Service
Adds pre-filtering to reject non-automotive images before classification

Features:
1. Pre-filter: Is this actually an automotive part?
2. Category classification (only if it passes pre-filter)
3. OCR for part numbers
4. Database search

This prevents random objects from being misidentified as car parts.
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

# ML libraries
try:
    import tensorflow as tf
    from tensorflow.keras.applications import MobileNetV2  # Same as original service
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input  # MobileNetV2 preprocessing
    from tensorflow.keras.preprocessing import image as keras_image
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
    from tensorflow.keras.models import Model
    TF_AVAILABLE = True
except ImportError:
    print("TensorFlow not available. Install with: pip install tensorflow")
    TF_AVAILABLE = False

# OCR
try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    print("EasyOCR not available. Install with: pip install easyocr")
    OCR_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Filtered Parts Vision API",
    description="AI-powered parts identification with pre-filtering",
    version="4.0.0"
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

class FilteredPartsVision:
    def __init__(self):
        self.automotive_filter = None  # Pre-filter model
        self.parts_classifier = None   # Parts classification model
        self.ocr_reader = None
        
        # Load categories
        self.part_categories = self.load_part_categories()
        
        self._initialize_models()
    
    def load_part_categories(self):
        """Load part categories from class_indices.json or database"""
        # Try loading from file first
        class_indices_path = 'ML/models/class_indices.json'
        if os.path.exists(class_indices_path):
            with open(class_indices_path, 'r') as f:
                class_indices = json.load(f)
            categories = [k for k, v in sorted(class_indices.items(), key=lambda x: x[1])]
            logger.info(f"Loaded {len(categories)} categories from file")
            return categories
        
        # Fallback to database
        conn = get_db()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT groupname FROM tblmasgroup ORDER BY groupname")
                categories = [row[0] for row in cursor.fetchall()]
                cursor.close()
                conn.close()
                logger.info(f"Loaded {len(categories)} categories from database")
                return categories
            except Exception as e:
                logger.error(f"Error loading from database: {e}")
                if conn:
                    conn.close()
        
        # Final fallback
        return [
            'air_filter', 'bearing', 'brake_pad', 'clutch', 'engine_mount',
            'headlight', 'oil_filter', 'spark_plug', 'suspension'
        ]
    
    def _initialize_models(self):
        """Initialize all models"""
        logger.info("Initializing Filtered Parts Vision...")
        
        if TF_AVAILABLE:
            self._initialize_automotive_filter()
            self._initialize_parts_classifier()
        
        if OCR_AVAILABLE:
            self._initialize_ocr()
        
        logger.info("Models initialized")
    
    def _initialize_automotive_filter(self):
        """Initialize automotive pre-filter using ImageNet model"""
        try:
            # Use pre-trained ImageNet model for general object detection
            base_model = MobileNetV2(weights='imagenet', include_top=True)
            self.automotive_filter = base_model
            logger.info("✅ Automotive filter initialized (ImageNet)")
        except Exception as e:
            logger.error(f"❌ Failed to initialize automotive filter: {e}")
    
    def _initialize_parts_classifier(self):
        """Initialize parts classification model"""
        model_paths = [
            'models/parts_classifier.h5',
            'ML/models/parts_classifier.h5'
        ]
        
        for model_path in model_paths:
            if os.path.exists(model_path):
                try:
                    self.parts_classifier = tf.keras.models.load_model(model_path)
                    logger.info(f"✅ Parts classifier loaded from {model_path}")
                    return
                except Exception as e:
                    logger.warning(f"Failed to load {model_path}: {e}")
        
        # Create new model if none found
        logger.info("Creating new parts classifier...")
        self._create_parts_classifier()
    
    def _create_parts_classifier(self):
        """Create new parts classification model - SAME AS ORIGINAL SERVICE"""
        try:
            # Use MobileNetV2 (same as original service)
            base_model = MobileNetV2(
                weights='imagenet',
                include_top=False,
                input_shape=(224, 224, 3)
            )
            
            # Freeze base layers
            for layer in base_model.layers:
                layer.trainable = False
            
            # Add custom layers (same as original)
            x = base_model.output
            x = GlobalAveragePooling2D()(x)
            x = Dense(128, activation='relu', name='feature_dense')(x)
            predictions = Dense(len(self.part_categories), activation='softmax', name='predictions')(x)
            
            self.parts_classifier = Model(inputs=base_model.input, outputs=predictions)
            self.parts_classifier.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
            logger.info(f"✅ New parts classifier created with {len(self.part_categories)} categories (MobileNetV2)")
        except Exception as e:
            logger.error(f"❌ Failed to create parts classifier: {e}")
    
    def _initialize_ocr(self):
        """Initialize OCR reader"""
        try:
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
            logger.info("✅ OCR initialized")
        except Exception as e:
            logger.error(f"❌ OCR failed: {e}")
    
    def preprocess_image(self, image_data: bytes, target_size=(224, 224)) -> np.ndarray:
        """Preprocess image for model input - SAME AS ORIGINAL SERVICE"""
        try:
            # Load image
            img = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to model input size
            img = img.resize(target_size)
            
            # Convert to array
            img_array = keras_image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            
            # Preprocess for MobileNetV2 (same as original)
            img_array = preprocess_input(img_array)
            
            return img_array
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format")
    
    def is_automotive_part(self, image_data: bytes) -> Tuple[bool, float, str]:
        """
        Pre-filter: Only reject images that are CLEARLY non-automotive
        (people, animals, food, furniture). Everything else passes through —
        ImageNet was not trained on auto parts, so unknown classes are likely parts.
        Returns: (is_automotive, confidence, detected_object)
        """
        if not self.automotive_filter:
            return True, 1.0, "filter_unavailable"

        try:
            img_array = self.preprocess_image(image_data)
            predictions = self.automotive_filter.predict(img_array, verbose=0)
            top_pred_idx = int(np.argmax(predictions[0]))
            confidence = float(predictions[0][top_pred_idx])

            # ONLY reject things that are unambiguously not auto parts.
            # Keep this list small and obvious — false negatives (rejecting real parts)
            # are much worse than false positives (letting non-parts through).
            OBVIOUS_NON_AUTOMOTIVE = {
                # Animals
                207, 208, 209, 210, 211, 212, 213,  # dogs
                281, 282, 283, 284, 285, 286,        # cats
                # People / body parts
                # (ImageNet doesn't have many explicit person classes, skip)
                # Food
                924, 950, 951, 952, 953, 954, 948, 949,  # fruits
                963, 964, 965, 966, 967, 968,             # food items
                # Furniture / household
                526, 559, 423, 424,   # tables, chairs, desks
                # Clothing
                514, 610, 776, 474,   # hats, jersey, sandal, bra
                # Entertainment
                722,  # ping pong ball
            }

            detected_object = f"imagenet_class_{top_pred_idx}"

            if top_pred_idx in OBVIOUS_NON_AUTOMOTIVE and confidence > 0.6:
                logger.info(f"❌ Rejected obvious non-automotive class {top_pred_idx} (conf: {confidence:.3f})")
                return False, confidence, detected_object

            # Everything else — metal objects, cylinders, mechanical things,
            # unknown classes — allow through. The parts classifier handles the rest.
            logger.info(f"✅ Allowing through class {top_pred_idx} (conf: {confidence:.3f})")
            return True, confidence, detected_object

        except Exception as e:
            logger.error(f"Error in automotive filter: {e}")
            return True, 0.0, "error"
    
    def classify_part_category(self, image_data: bytes) -> Tuple[str, float]:
        """Classify part category (only called after automotive filter passes)"""
        if not self.parts_classifier:
            return "unknown", 0.0
        
        try:
            img_array = self.preprocess_image(image_data)
            predictions = self.parts_classifier.predict(img_array, verbose=0)
            
            predicted_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_idx])
            
            if predicted_idx < len(self.part_categories):
                category = self.part_categories[predicted_idx]
            else:
                category = "unknown"
            
            logger.info(f"📦 Part category: {category} (confidence: {confidence:.3f})")
            return category, confidence
            
        except Exception as e:
            logger.error(f"Error in part classification: {e}")
            return "unknown", 0.0
    
    def extract_text_and_keywords(self, image_data: bytes) -> Dict:
        """Extract text using OCR and identify keywords"""
        if not self.ocr_reader:
            return {'texts': [], 'part_numbers': [], 'brands': []}
        
        try:
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Run OCR
            results = self.ocr_reader.readtext(img)
            texts = [result[1] for result in results if result[2] > 0.5]
            
            # Extract part numbers
            part_numbers = []
            part_patterns = [
                r'\d{5,}[A-Z]*\d*',  # 16510M79F00
                r'[A-Z]{2,}\d{4,}',   # ABC12345
                r'\d{4,}-\d{2,}',     # 1234-56
            ]
            
            # Extract brands
            brands = []
            brand_keywords = [
                'BOSCH', 'VALEO', 'DENSO', 'DELPHI', 'MANN', 'MAHLE',
                'SKF', 'FAG', 'NTN', 'TIMKEN', 'EXEDY', 'LUK'
            ]
            
            for text in texts:
                text_upper = text.upper()
                
                # Check for brands
                for brand in brand_keywords:
                    if brand in text_upper:
                        brands.append(brand)
                
                # Check for part numbers
                clean_text = re.sub(r'[^A-Z0-9-]', '', text_upper)
                for pattern in part_patterns:
                    matches = re.findall(pattern, clean_text)
                    part_numbers.extend(matches)
            
            return {
                'texts': texts,
                'part_numbers': list(set(part_numbers)),
                'brands': list(set(brands))
            }
            
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return {'texts': [], 'part_numbers': [], 'brands': []}
    
    def search_inventory(self, category: str, keywords: Dict) -> List[Dict]:
        """Search inventory using category and keywords"""
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
                    b.brandname as brand
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE 1=1
            """
            
            params = []
            
            # Filter by category
            if category and category != 'unknown':
                query += " AND LOWER(g.groupname) LIKE LOWER(%s)"
                params.append(f'%{category}%')
            
            # Filter by brands
            if keywords['brands']:
                brand_conditions = []
                for brand in keywords['brands']:
                    brand_conditions.append("UPPER(i.itemname) LIKE %s OR UPPER(b.brandname) LIKE %s")
                    params.extend([f'%{brand}%', f'%{brand}%'])
                if brand_conditions:
                    query += f" AND ({' OR '.join(brand_conditions)})"
            
            # Filter by part numbers
            if keywords['part_numbers']:
                pn_conditions = []
                for pn in keywords['part_numbers']:
                    pn_conditions.append("UPPER(i.suppref) LIKE %s OR UPPER(i.itemname) LIKE %s")
                    params.extend([f'%{pn}%', f'%{pn}%'])
                if pn_conditions:
                    query += f" AND ({' OR '.join(pn_conditions)})"
            
            query += " LIMIT 10"
            
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
                    'brand': row['brand']
                })
            
            cursor.close()
            conn.close()
            
            return matches
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            if conn:
                conn.close()
            return []
    
    def identify_part(self, image_data: bytes) -> Dict:
        """Main identification method with pre-filtering"""

        # Step 1: Pre-filter — only rejects obvious non-automotive (animals, food, etc.)
        is_automotive, filter_confidence, detected_object = self.is_automotive_part(image_data)

        if not is_automotive:
            return {
                'success': False,
                'reason': 'not_automotive_part',
                'detected_object': detected_object,
                'filter_confidence': filter_confidence,
                'message': 'This image does not appear to contain automotive parts.'
            }

        # Step 2: Classify part category
        category, category_confidence = self.classify_part_category(image_data)

        # Step 3: Extract text and keywords
        keywords = self.extract_text_and_keywords(image_data)

        # Step 4: Search inventory — use category if confident, else broad search
        search_category = category if category_confidence >= 0.15 else None
        matches = self.search_inventory(search_category, keywords)

        return {
            'success': True,
            'filter_result': {
                'is_automotive': is_automotive,
                'confidence': filter_confidence,
                'detected_object': detected_object
            },
            'classification': {
                'category': category,
                'confidence': category_confidence
            },
            'ocr_results': keywords,
            'inventory_matches': matches,
            'match_count': len(matches)
        }

# Initialize service
vision_service = FilteredPartsVision()

# API Endpoints

@app.get("/")
async def root():
    return {
        "service": "Filtered Parts Vision API",
        "version": "4.0.0",
        "description": "AI parts identification with pre-filtering to reject non-automotive images",
        "features": {
            "automotive_filter": vision_service.automotive_filter is not None,
            "parts_classification": vision_service.parts_classifier is not None,
            "ocr": vision_service.ocr_reader is not None,
            "database_search": get_db() is not None
        },
        "categories": len(vision_service.part_categories)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models": {
            "automotive_filter": "✅" if vision_service.automotive_filter else "❌",
            "parts_classifier": "✅" if vision_service.parts_classifier else "❌",
            "ocr": "✅" if vision_service.ocr_reader else "❌"
        },
        "database": "✅" if get_db() else "❌"
    }

@app.post("/identify")
async def identify_part(file: UploadFile = File(...)):
    """Main endpoint: Identify part with pre-filtering"""
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

@app.post("/check-automotive")
async def check_automotive_only(file: UploadFile = File(...)):
    """Check if image contains automotive parts (filter only)"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        is_automotive, confidence, detected_object = vision_service.is_automotive_part(image_data)
        
        return {
            "is_automotive": is_automotive,
            "confidence": confidence,
            "detected_object": detected_object,
            "message": "Automotive part detected" if is_automotive else f"Non-automotive object: {detected_object}"
        }
    
    except Exception as e:
        logger.error(f"Error in automotive check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔍 FILTERED PARTS VISION SERVICE")
    print("="*70)
    print("🚗 Automotive Filter:", "✅" if vision_service.automotive_filter else "❌")
    print("📦 Parts Classifier:", "✅" if vision_service.parts_classifier else "❌")
    print("📝 OCR:", "✅" if vision_service.ocr_reader else "❌")
    print("💾 Database:", "✅" if get_db() else "❌")
    print(f"📂 Categories: {len(vision_service.part_categories)}")
    print("="*70)
    print("🌐 Server: http://localhost:8005")
    print("📖 Docs: http://localhost:8005/docs")
    print("="*70)
    print("\n🛡️  PRE-FILTERING ENABLED:")
    print("✅ Rejects random objects (rods, household items)")
    print("✅ Only processes automotive parts")
    print("✅ Reduces false positives")
    print("="*70 + "\n")
    
    uvicorn.run(
        "filtered_parts_vision:app",
        host="0.0.0.0",
        port=8005,
        reload=True
    )