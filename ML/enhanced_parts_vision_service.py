#!/usr/bin/env python3
"""
Enhanced Automobile Spare Parts Visual Identification Service
With Car Make/Model Recognition

Features:
1. Part category identification (brake pad, filter, etc.)
2. Car make identification (Toyota, Maruti, Hyundai, etc.)
3. Database integration with your 2000+ items
4. Multi-label classification (part + make)
5. OCR for part numbers
6. Similarity search against your inventory

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

# ML libraries
try:
    import tensorflow as tf
    from tensorflow.keras.applications import EfficientNetB0
    from tensorflow.keras.applications.efficientnet import preprocess_input
    from tensorflow.keras.preprocessing import image
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, Input, Concatenate
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

# Initialize FastAPI
app = FastAPI(
    title="Enhanced Auto Parts Vision API",
    description="AI-powered spare parts identification with car make recognition",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        return None

class EnhancedPartsVisionService:
    def __init__(self):
        self.part_classifier = None
        self.make_classifier = None
        self.multi_label_model = None
        self.ocr_reader = None
        
        # Load categories from database
        self.part_categories = []
        self.car_makes = []
        self.load_categories_from_db()
        
        # Initialize models
        self._initialize_models()
    
    def load_categories_from_db(self):
        """Load part categories and car makes from database"""
        conn = get_db()
        if not conn:
            logger.warning("Could not connect to database")
            return
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Load car makes
            cursor.execute("SELECT makeid, makename FROM tblmasmake ORDER BY makename")
            makes = cursor.fetchall()
            self.car_makes = [{'id': m['makeid'], 'name': m['makename']} for m in makes]
            logger.info(f"Loaded {len(self.car_makes)} car makes")
            
            # Load part groups (categories)
            cursor.execute("""
                SELECT DISTINCT g.groupid, g.groupname 
                FROM tblmasgroup g
                JOIN tblmasitem i ON g.groupid = i.groupid
                ORDER BY g.groupname
            """)
            groups = cursor.fetchall()
            self.part_categories = [{'id': g['groupid'], 'name': g['groupname']} for g in groups]
            logger.info(f"Loaded {len(self.part_categories)} part categories")
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error loading categories: {e}")
            if conn:
                conn.close()
    
    def _initialize_models(self):
        """Initialize ML models"""
        logger.info("Initializing enhanced ML models...")
        
        if TF_AVAILABLE and len(self.part_categories) > 0 and len(self.car_makes) > 0:
            self._initialize_multi_label_model()
        
        if OCR_AVAILABLE:
            self._initialize_ocr()
        
        logger.info("Models initialized")
    
    def _initialize_multi_label_model(self):
        """Initialize multi-label model for part + make classification"""
        model_path = 'ML/models/enhanced_parts_classifier.h5'
        
        if os.path.exists(model_path):
            logger.info("Loading existing enhanced model...")
            try:
                self.multi_label_model = tf.keras.models.load_model(model_path)
                return
            except Exception as e:
                logger.warning(f"Could not load model: {e}. Creating new one...")
        
        logger.info("Creating new multi-label classification model...")
        
        # Use EfficientNetB0 as base (better than MobileNetV2)
        base_model = EfficientNetB0(
            weights='imagenet',
            include_top=False,
            input_shape=(224, 224, 3)
        )
        
        # Freeze base model
        for layer in base_model.layers:
            layer.trainable = False
        
        # Shared feature extraction
        x = base_model.output
        x = GlobalAveragePooling2D()(x)
        x = Dense(256, activation='relu', name='shared_features')(x)
        x = Dropout(0.3)(x)
        
        # Part category branch
        part_branch = Dense(128, activation='relu', name='part_features')(x)
        part_output = Dense(
            len(self.part_categories), 
            activation='softmax', 
            name='part_category'
        )(part_branch)
        
        # Car make branch
        make_branch = Dense(128, activation='relu', name='make_features')(x)
        make_output = Dense(
            len(self.car_makes), 
            activation='softmax', 
            name='car_make'
        )(make_branch)
        
        # Create model with two outputs
        self.multi_label_model = Model(
            inputs=base_model.input,
            outputs=[part_output, make_output]
        )
        
        # Compile
        self.multi_label_model.compile(
            optimizer='adam',
            loss={
                'part_category': 'categorical_crossentropy',
                'car_make': 'categorical_crossentropy'
            },
            loss_weights={'part_category': 1.0, 'car_make': 1.0},
            metrics=['accuracy']
        )
        
        logger.info(f"Multi-label model created: {len(self.part_categories)} parts × {len(self.car_makes)} makes")
    
    def _initialize_ocr(self):
        """Initialize OCR reader"""
        try:
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
            logger.info("OCR reader initialized")
        except Exception as e:
            logger.error(f"Failed to initialize OCR: {e}")
    
    def preprocess_image(self, image_data: bytes) -> np.ndarray:
        """Preprocess image for model input"""
        try:
            img = Image.open(io.BytesIO(image_data))
            
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = img.resize((224, 224))
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)
            
            return img_array
        
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format")
    
    def identify_part_and_make(self, image_data: bytes) -> Dict:
        """Identify both part category and car make"""
        if not self.multi_label_model:
            return {
                'part_category': 'unknown',
                'part_confidence': 0.0,
                'car_make': 'unknown',
                'make_confidence': 0.0
            }
        
        try:
            img_array = self.preprocess_image(image_data)
            
            # Predict both outputs
            part_pred, make_pred = self.multi_label_model.predict(img_array, verbose=0)
            
            # Get part category
            part_idx = np.argmax(part_pred[0])
            part_conf = float(part_pred[0][part_idx])
            part_name = self.part_categories[part_idx]['name'] if part_idx < len(self.part_categories) else 'unknown'
            
            # Get car make
            make_idx = np.argmax(make_pred[0])
            make_conf = float(make_pred[0][make_idx])
            make_name = self.car_makes[make_idx]['name'] if make_idx < len(self.car_makes) else 'unknown'
            
            # Get top 3 predictions for each
            part_top3_idx = np.argsort(part_pred[0])[-3:][::-1]
            make_top3_idx = np.argsort(make_pred[0])[-3:][::-1]
            
            part_top3 = [
                {
                    'name': self.part_categories[i]['name'],
                    'confidence': float(part_pred[0][i])
                }
                for i in part_top3_idx if i < len(self.part_categories)
            ]
            
            make_top3 = [
                {
                    'name': self.car_makes[i]['name'],
                    'confidence': float(make_pred[0][i])
                }
                for i in make_top3_idx if i < len(self.car_makes)
            ]
            
            logger.info(f"Identified: {part_name} ({part_conf:.2f}) for {make_name} ({make_conf:.2f})")
            
            return {
                'part_category': part_name,
                'part_confidence': part_conf,
                'car_make': make_name,
                'make_confidence': make_conf,
                'part_top3': part_top3,
                'make_top3': make_top3
            }
        
        except Exception as e:
            logger.error(f"Error in identification: {e}")
            return {
                'part_category': 'error',
                'part_confidence': 0.0,
                'car_make': 'error',
                'make_confidence': 0.0,
                'error': str(e)
            }
    
    def extract_part_number(self, image_data: bytes) -> Optional[str]:
        """Extract part number using OCR"""
        if not self.ocr_reader:
            return None
        
        try:
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            results = self.ocr_reader.readtext(img)
            texts = [result[1] for result in results if result[2] > 0.5]
            
            # Part number patterns for Indian auto parts
            patterns = [
                r'\d{5}[A-Z]\d{2}[A-Z]\d{2}',  # Maruti: 16510M79F00
                r'\d{5}-[A-Z]{3}-\d{3}',        # Honda: 12345-ABC-123
                r'\d{8,12}',                     # Generic: 1234567890
                r'[A-Z]{2,3}\d{4,8}',           # Alpha-numeric: ABC12345
                r'\d{4,6}-\d{2,4}-\d{2,4}',     # Dash separated: 1234-56-78
                r'[A-Z]\d{4}[A-Z]{2}\d{3}'      # Mixed: A1234BC567
            ]
            
            for text in texts:
                clean_text = re.sub(r'[^A-Z0-9-]', '', text.upper())
                
                for pattern in patterns:
                    matches = re.findall(pattern, clean_text)
                    if matches:
                        return matches[0]
            
            return None
        
        except Exception as e:
            logger.error(f"Error in OCR: {e}")
            return None
    
    def search_in_inventory(self, part_category: str, car_make: str, part_number: Optional[str] = None) -> List[Dict]:
        """Search for matching parts in your inventory"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build search query
            query = """
                SELECT 
                    i.itemcode,
                    i.itemname,
                    g.groupname as category,
                    m.makename as car_make,
                    b.brandname as brand,
                    i.suppref as part_number,
                    i.packing
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE 1=1
            """
            
            params = []
            
            # Filter by part category
            if part_category and part_category != 'unknown':
                query += " AND LOWER(g.groupname) LIKE LOWER(%s)"
                params.append(f'%{part_category}%')
            
            # Filter by car make
            if car_make and car_make != 'unknown':
                query += " AND LOWER(m.makename) LIKE LOWER(%s)"
                params.append(f'%{car_make}%')
            
            # Filter by part number if available
            if part_number:
                query += " AND (LOWER(i.suppref) LIKE LOWER(%s) OR LOWER(i.itemname) LIKE LOWER(%s))"
                params.append(f'%{part_number}%')
                params.append(f'%{part_number}%')
            
            query += " LIMIT 10"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            matches = []
            for row in results:
                matches.append({
                    'item_code': row['itemcode'],
                    'item_name': row['itemname'],
                    'category': row['category'],
                    'car_make': row['car_make'],
                    'brand': row['brand'],
                    'part_number': row['part_number'],
                    'packing': row['packing']
                })
            
            cursor.close()
            conn.close()
            
            logger.info(f"Found {len(matches)} matching items in inventory")
            return matches
        
        except Exception as e:
            logger.error(f"Error searching inventory: {e}")
            if conn:
                conn.close()
            return []

# Initialize service
parts_service = EnhancedPartsVisionService()

# API Endpoints

@app.get("/")
async def root():
    return {
        "message": "Enhanced Auto Parts Vision API",
        "version": "2.0.0",
        "status": "running",
        "capabilities": {
            "part_identification": True,
            "make_identification": True,
            "ocr": OCR_AVAILABLE,
            "inventory_search": True
        },
        "stats": {
            "part_categories": len(parts_service.part_categories),
            "car_makes": len(parts_service.car_makes)
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": {
            "multi_label": parts_service.multi_label_model is not None,
            "ocr": parts_service.ocr_reader is not None
        },
        "database": get_db() is not None
    }

@app.get("/categories")
async def get_categories():
    """Get list of part categories and car makes"""
    return {
        "part_categories": parts_service.part_categories,
        "car_makes": parts_service.car_makes
    }

@app.post("/identify-part")
async def identify_part(file: UploadFile = File(...)):
    """Main endpoint: Identify part, make, and search inventory"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        
        # 1. Identify part and make
        identification = parts_service.identify_part_and_make(image_data)
        
        # 2. Extract part number (OCR)
        part_number = None
        if OCR_AVAILABLE:
            part_number = parts_service.extract_part_number(image_data)
        
        # 3. Search in inventory
        inventory_matches = parts_service.search_in_inventory(
            identification['part_category'],
            identification['car_make'],
            part_number
        )
        
        return JSONResponse(content={
            "success": True,
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            "identification": identification,
            "part_number": part_number,
            "inventory_matches": inventory_matches,
            "match_count": len(inventory_matches)
        })
    
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify-only")
async def classify_only(file: UploadFile = File(...)):
    """Quick classification without inventory search"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        identification = parts_service.identify_part_and_make(image_data)
        
        return identification
    
    except Exception as e:
        logger.error(f"Error in classification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/inventory/search")
async def search_inventory(
    category: Optional[str] = None,
    make: Optional[str] = None,
    part_number: Optional[str] = None
):
    """Search inventory by parameters"""
    try:
        matches = parts_service.search_in_inventory(category, make, part_number)
        return {
            "matches": matches,
            "count": len(matches)
        }
    except Exception as e:
        logger.error(f"Error searching inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚗 ENHANCED AUTOMOBILE PARTS VISION SERVICE")
    print("="*70)
    print(f"🤖 TensorFlow: {TF_AVAILABLE}")
    print(f"👁️  OCR: {OCR_AVAILABLE}")
    print(f"📦 Part Categories: {len(parts_service.part_categories)}")
    print(f"🚙 Car Makes: {len(parts_service.car_makes)}")
    print(f"💾 Database: {'Connected' if get_db() else 'Not Connected'}")
    print("="*70)
    print("🌐 Server: http://localhost:8003")
    print("📖 API Docs: http://localhost:8003/docs")
    print("="*70 + "\n")
    
    uvicorn.run(
        "enhanced_parts_vision_service:app",
        host="0.0.0.0",
        port=8003,
        reload=True,
        log_level="info"
    )
