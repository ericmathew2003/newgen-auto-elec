#!/usr/bin/env python3
"""
Automobile Spare Parts Visual Identification Service

This service provides:
1. Image classification for part categories
2. OCR for part number extraction
3. Image similarity search
4. Feature extraction

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
from pathlib import Path

# FastAPI and file handling
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Image processing
from PIL import Image
import cv2

# ML libraries
try:
    import tensorflow as tf
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    from tensorflow.keras.preprocessing import image
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
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

# Similarity search
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    print("FAISS not available. Install with: pip install faiss-cpu")
    FAISS_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Automobile Parts Vision API",
    description="AI-powered spare parts identification system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Part categories - Load from class_indices.json if available
def load_part_categories():
    """Load part categories from trained model"""
    class_indices_path = 'ML/models/class_indices.json'
    if os.path.exists(class_indices_path):
        with open(class_indices_path, 'r') as f:
            class_indices = json.load(f)
        # Sort by index to get correct order
        categories = [k for k, v in sorted(class_indices.items(), key=lambda x: x[1])]
        logger.info(f"Loaded {len(categories)} categories from class_indices.json")
        return categories
    else:
        # Fallback to default categories
        logger.warning("class_indices.json not found, using default categories")
        return [
            'ac_filter',
            'air_filter',
            'bearing',
            'engine_mount',
            'headlight',
            'oil_filter',
            'suspension'
        ]

PART_CATEGORIES = load_part_categories()

class PartsVisionService:
    def __init__(self):
        self.classification_model = None
        self.feature_extractor = None
        self.ocr_reader = None
        self.faiss_index = None
        self.part_ids = []
        
        # Create directories
        os.makedirs('uploads', exist_ok=True)
        os.makedirs('models', exist_ok=True)
        
        # Initialize components
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize all ML models"""
        logger.info("Initializing ML models...")
        
        # Initialize classification model
        if TF_AVAILABLE:
            self._initialize_classification_model()
            self._initialize_feature_extractor()
        
        # Initialize OCR
        if OCR_AVAILABLE:
            self._initialize_ocr()
        
        # Initialize similarity search
        if FAISS_AVAILABLE:
            self._initialize_similarity_search()
        
        logger.info("ML models initialized successfully")
    
    def _initialize_classification_model(self):
        """Initialize or load classification model"""
        model_path = 'ML/models/parts_classifier.h5'
        
        if os.path.exists(model_path):
            logger.info("Loading existing classification model...")
            self.classification_model = tf.keras.models.load_model(model_path)
        else:
            logger.info("Creating new classification model with transfer learning...")
            # Create model with transfer learning
            base_model = MobileNetV2(
                weights='imagenet',
                include_top=False,
                input_shape=(224, 224, 3)
            )
            
            # Freeze base model layers
            for layer in base_model.layers:
                layer.trainable = False
            
            # Add custom layers
            x = base_model.output
            x = GlobalAveragePooling2D()(x)
            x = Dense(128, activation='relu', name='feature_dense')(x)
            predictions = Dense(len(PART_CATEGORIES), activation='softmax', name='predictions')(x)
            
            self.classification_model = Model(inputs=base_model.input, outputs=predictions)
            
            # Compile model
            self.classification_model.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
            logger.info(f"Model created with {len(PART_CATEGORIES)} categories")
    
    def _initialize_feature_extractor(self):
        """Initialize feature extractor for similarity search"""
        if self.classification_model:
            # Use the feature layer before final classification
            self.feature_extractor = Model(
                inputs=self.classification_model.input,
                outputs=self.classification_model.get_layer('feature_dense').output
            )
            logger.info("Feature extractor initialized")
    
    def _initialize_ocr(self):
        """Initialize OCR reader"""
        try:
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
            logger.info("OCR reader initialized")
        except Exception as e:
            logger.error(f"Failed to initialize OCR: {e}")
    
    def _initialize_similarity_search(self):
        """Initialize FAISS similarity search"""
        index_path = 'models/parts_index.faiss'
        ids_path = 'models/part_ids.json'
        
        if os.path.exists(index_path) and os.path.exists(ids_path):
            try:
                self.faiss_index = faiss.read_index(index_path)
                with open(ids_path, 'r') as f:
                    self.part_ids = json.load(f)
                logger.info(f"Loaded FAISS index with {len(self.part_ids)} parts")
            except Exception as e:
                logger.error(f"Failed to load FAISS index: {e}")
        else:
            logger.info("No existing FAISS index found. Will create when training data is available.")
    
    def preprocess_image(self, image_data: bytes) -> np.ndarray:
        """Preprocess image for model input"""
        try:
            # Load image
            img = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to model input size
            img = img.resize((224, 224))
            
            # Convert to array
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            
            # Preprocess for MobileNetV2
            img_array = preprocess_input(img_array)
            
            return img_array
        
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format")
    
    def classify_part(self, image_data: bytes) -> Tuple[str, float]:
        """Classify part category from image"""
        if not self.classification_model:
            return "unknown", 0.0
        
        try:
            # Preprocess image
            img_array = self.preprocess_image(image_data)
            
            # Make prediction
            predictions = self.classification_model.predict(img_array, verbose=0)
            
            # Get top prediction
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            predicted_category = PART_CATEGORIES[predicted_class_idx]
            
            logger.info(f"Classified as {predicted_category} with confidence {confidence:.3f}")
            
            return predicted_category, confidence
        
        except Exception as e:
            logger.error(f"Error in classification: {e}")
            return "unknown", 0.0
    
    def extract_part_number(self, image_data: bytes) -> Optional[str]:
        """Extract part number using OCR"""
        if not self.ocr_reader:
            return None
        
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Run OCR
            results = self.ocr_reader.readtext(img)
            
            # Extract text
            texts = [result[1] for result in results if result[2] > 0.5]  # confidence > 0.5
            
            # Part number patterns
            patterns = [
                r'\d{5}[A-Z]\d{2}[A-Z]\d{2}',  # Maruti pattern: 16510M79F00
                r'\d{5}-[A-Z]{3}-\d{3}',        # Honda pattern: 12345-ABC-123
                r'\d{8,12}',                     # Generic numeric: 1234567890
                r'[A-Z]{2,3}\d{4,8}',           # Alpha-numeric: ABC12345
                r'\d{4,6}-\d{2,4}-\d{2,4}'      # Dash separated: 1234-56-78
            ]
            
            # Search for part numbers
            for text in texts:
                # Clean text
                clean_text = re.sub(r'[^A-Z0-9-]', '', text.upper())
                
                for pattern in patterns:
                    matches = re.findall(pattern, clean_text)
                    if matches:
                        part_number = matches[0]
                        logger.info(f"Extracted part number: {part_number}")
                        return part_number
            
            logger.info("No part number found in image")
            return None
        
        except Exception as e:
            logger.error(f"Error in OCR: {e}")
            return None
    
    def extract_features(self, image_data: bytes) -> Optional[np.ndarray]:
        """Extract feature vector for similarity search"""
        if not self.feature_extractor:
            return None
        
        try:
            img_array = self.preprocess_image(image_data)
            features = self.feature_extractor.predict(img_array, verbose=0)
            return features.flatten()
        
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return None
    
    def find_similar_parts(self, image_data: bytes, k: int = 5) -> List[Dict]:
        """Find similar parts using FAISS"""
        if not self.faiss_index or not self.part_ids:
            return []
        
        try:
            # Extract features
            features = self.extract_features(image_data)
            if features is None:
                return []
            
            # Search similar
            features = np.array([features]).astype('float32')
            distances, indices = self.faiss_index.search(features, k)
            
            # Format results
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < len(self.part_ids):
                    similarity_score = float(1 / (1 + distances[0][i]))  # Convert distance to similarity
                    results.append({
                        'part_id': self.part_ids[idx],
                        'similarity_score': similarity_score,
                        'distance': float(distances[0][i])
                    })
            
            return results
        
        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            return []

# Initialize service
parts_service = PartsVisionService()

# API Endpoints

@app.get("/")
async def root():
    return {
        "message": "Automobile Parts Vision API",
        "version": "1.0.0",
        "status": "running",
        "features": {
            "classification": TF_AVAILABLE,
            "ocr": OCR_AVAILABLE,
            "similarity_search": FAISS_AVAILABLE
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": {
            "classification": parts_service.classification_model is not None,
            "ocr": parts_service.ocr_reader is not None,
            "similarity": parts_service.faiss_index is not None
        }
    }

@app.get("/categories")
async def get_categories():
    """Get list of supported part categories"""
    return {
        "categories": PART_CATEGORIES,
        "count": len(PART_CATEGORIES)
    }

@app.post("/identify-part")
async def identify_part(file: UploadFile = File(...)):
    """Main endpoint for part identification"""
    try:
        # Validate file
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await file.read()
        
        # Process image
        results = {}
        
        # 1. Classify part category
        if TF_AVAILABLE:
            category, confidence = parts_service.classify_part(image_data)
            results['category'] = category
            results['confidence'] = confidence
        
        # 2. Extract part number (OCR)
        if OCR_AVAILABLE:
            part_number = parts_service.extract_part_number(image_data)
            results['part_number'] = part_number
        
        # 3. Find similar parts
        if FAISS_AVAILABLE:
            similar_parts = parts_service.find_similar_parts(image_data)
            results['similar_parts'] = similar_parts
        
        # 4. Extract features for future use
        if TF_AVAILABLE:
            features = parts_service.extract_features(image_data)
            if features is not None:
                results['feature_vector_size'] = len(features)
        
        return JSONResponse(content={
            "success": True,
            "filename": file.filename,
            "results": results
        })
    
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify")
async def classify_only(file: UploadFile = File(...)):
    """Classification only endpoint"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        category, confidence = parts_service.classify_part(image_data)
        
        return {
            "category": category,
            "confidence": confidence,
            "category_display": category.replace('_', ' ').title()
        }
    
    except Exception as e:
        logger.error(f"Error in classification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """OCR text extraction endpoint"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        part_number = parts_service.extract_part_number(image_data)
        
        return {
            "part_number": part_number,
            "found": part_number is not None
        }
    
    except Exception as e:
        logger.error(f"Error in OCR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/similarity-search")
async def similarity_search(file: UploadFile = File(...), k: int = 5):
    """Similarity search endpoint"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        similar_parts = parts_service.find_similar_parts(image_data, k)
        
        return {
            "similar_parts": similar_parts,
            "count": len(similar_parts)
        }
    
    except Exception as e:
        logger.error(f"Error in similarity search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚗 AUTOMOBILE PARTS VISION SERVICE")
    print("="*60)
    print(f"🤖 TensorFlow Available: {TF_AVAILABLE}")
    print(f"👁️  OCR Available: {OCR_AVAILABLE}")
    print(f"🔍 FAISS Available: {FAISS_AVAILABLE}")
    print(f"📂 Categories: {len(PART_CATEGORIES)}")
    print("="*60)
    print("🌐 Starting server on http://localhost:8002")
    print("📖 API docs: http://localhost:8002/docs")
    print("="*60 + "\n")
    
    uvicorn.run(
        "parts_vision_service:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
