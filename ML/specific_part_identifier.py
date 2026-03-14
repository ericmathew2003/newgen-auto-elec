#!/usr/bin/env python3
"""
Specific Auto Part Identifier
Identifies EXACT parts (not just categories) using Hybrid AI + OCR + Database approach

Example: "BOSCH CLUTCH SLAVE CYLINDER BOLERO CSC - 0986AB8563E7A"
Not just: "Clutch"
"""

import os
import io
import re
import numpy as np
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from difflib import SequenceMatcher

# FastAPI
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    from tensorflow.keras.preprocessing import image as keras_image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

# OCR
try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Specific Part Identifier", version="3.0.0")

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

class SpecificPartIdentifier:
    def __init__(self):
        self.category_model = None
        self.ocr_reader = None
        
        # Brand keywords to look for
        self.brand_keywords = [
            'BOSCH', 'VALEO', 'DENSO', 'DELPHI', 'MANN', 'MAHLE',
            'SKF', 'FAG', 'NTN', 'TIMKEN', 'EXEDY', 'LUK',
            'SACHS', 'ZF', 'BREMBO', 'ATE', 'TRW', 'MANDO'
        ]
        
        self._initialize()
    
    def _initialize(self):
        """Initialize models"""
        logger.info("Initializing Specific Part Identifier...")
        
        if TF_AVAILABLE:
            self._load_category_model()
        
        if OCR_AVAILABLE:
            try:
                self.ocr_reader = easyocr.Reader(['en'], gpu=False)
                logger.info("✅ OCR initialized")
            except Exception as e:
                logger.error(f"❌ OCR failed: {e}")
        
        logger.info("Initialization complete")
    
    def _load_category_model(self):
        """Load category classification model"""
        model_path = 'ML/models/parts_classifier.h5'
        if os.path.exists(model_path):
            try:
                self.category_model = tf.keras.models.load_model(model_path)
                logger.info("✅ Category model loaded")
            except:
                logger.warning("⚠️ Could not load category model")
    
    def extract_all_text(self, image_data: bytes) -> List[str]:
        """Extract ALL text from image using OCR"""
        if not self.ocr_reader:
            return []
        
        try:
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Enhance image for better OCR
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            enhanced = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Run OCR on both original and enhanced
            results1 = self.ocr_reader.readtext(img)
            results2 = self.ocr_reader.readtext(enhanced)
            
            # Combine results
            all_texts = []
            for result in results1 + results2:
                if result[2] > 0.3:  # Lower confidence threshold
                    text = result[1].strip()
                    if text and len(text) > 1:
                        all_texts.append(text)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_texts = []
            for text in all_texts:
                text_upper = text.upper()
                if text_upper not in seen:
                    seen.add(text_upper)
                    unique_texts.append(text)
            
            logger.info(f"📝 Extracted {len(unique_texts)} text elements")
            return unique_texts
        
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return []
    
    def extract_keywords(self, texts: List[str]) -> Dict:
        """Extract useful keywords from OCR text"""
        keywords = {
            'brands': [],
            'part_numbers': [],
            'car_models': [],
            'other_keywords': []
        }
        
        # Common car model names
        car_models = [
            'BOLERO', 'SCORPIO', 'SWIFT', 'DZIRE', 'BALENO', 'CRETA',
            'VERNA', 'I20', 'I10', 'CITY', 'AMAZE', 'JAZZ', 'NEXON',
            'TIAGO', 'ALTROZ', 'HARRIER', 'INNOVA', 'FORTUNER', 'ETIOS'
        ]
        
        # Part number patterns
        part_patterns = [
            r'\d{5,}[A-Z]*\d*',  # 16510M79F00
            r'[A-Z]{2,}\d{4,}',   # ABC12345
            r'\d{4,}-\d{2,}',     # 1234-56
        ]
        
        for text in texts:
            text_upper = text.upper()
            
            # Check for brands
            for brand in self.brand_keywords:
                if brand in text_upper:
                    keywords['brands'].append(brand)
            
            # Check for car models
            for model in car_models:
                if model in text_upper:
                    keywords['car_models'].append(model)
            
            # Check for part numbers
            clean_text = re.sub(r'[^A-Z0-9-]', '', text_upper)
            for pattern in part_patterns:
                matches = re.findall(pattern, clean_text)
                if matches:
                    keywords['part_numbers'].extend(matches)
            
            # Other meaningful keywords (length > 3)
            if len(text) > 3 and not any(char.isdigit() for char in text):
                keywords['other_keywords'].append(text_upper)
        
        # Remove duplicates
        for key in keywords:
            keywords[key] = list(set(keywords[key]))
        
        return keywords
    
    def search_specific_parts(self, keywords: Dict, category_hint: Optional[str] = None) -> List[Dict]:
        """Search for specific parts in database using extracted keywords"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build smart search query
            query = """
                SELECT 
                    i.itemcode,
                    i.itemname,
                    i.suppref as part_number,
                    g.groupname as category,
                    m.makename as car_make,
                    b.brandname as brand,
                    i.packing,
                    0 as match_score
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE 1=1
            """
            
            conditions = []
            params = []
            
            # Search by brands
            if keywords['brands']:
                brand_conditions = []
                for brand in keywords['brands']:
                    brand_conditions.append("UPPER(i.itemname) LIKE %s OR UPPER(b.brandname) LIKE %s")
                    params.extend([f'%{brand}%', f'%{brand}%'])
                if brand_conditions:
                    conditions.append(f"({' OR '.join(brand_conditions)})")
            
            # Search by part numbers
            if keywords['part_numbers']:
                pn_conditions = []
                for pn in keywords['part_numbers']:
                    pn_conditions.append("UPPER(i.suppref) LIKE %s OR UPPER(i.itemname) LIKE %s")
                    params.extend([f'%{pn}%', f'%{pn}%'])
                if pn_conditions:
                    conditions.append(f"({' OR '.join(pn_conditions)})")
            
            # Search by car models
            if keywords['car_models']:
                model_conditions = []
                for model in keywords['car_models']:
                    model_conditions.append("UPPER(i.itemname) LIKE %s")
                    params.append(f'%{model}%')
                if model_conditions:
                    conditions.append(f"({' OR '.join(model_conditions)})")
            
            # Search by other keywords
            if keywords['other_keywords']:
                kw_conditions = []
                for kw in keywords['other_keywords'][:5]:  # Limit to top 5
                    if len(kw) > 4:  # Only meaningful keywords
                        kw_conditions.append("UPPER(i.itemname) LIKE %s")
                        params.append(f'%{kw}%')
                if kw_conditions:
                    conditions.append(f"({' OR '.join(kw_conditions)})")
            
            # Add category hint if available
            if category_hint:
                conditions.append("UPPER(g.groupname) LIKE %s")
                params.append(f'%{category_hint}%')
            
            # Combine conditions
            if conditions:
                query += " AND (" + " OR ".join(conditions) + ")"
            
            query += " LIMIT 20"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            # Calculate match scores
            matches = []
            for row in results:
                item_text = f"{row['itemname']} {row['part_number'] or ''} {row['brand'] or ''}".upper()
                
                # Calculate similarity score
                score = 0
                
                # Brand match (high weight)
                for brand in keywords['brands']:
                    if brand in item_text:
                        score += 30
                
                # Part number match (highest weight)
                for pn in keywords['part_numbers']:
                    if pn in item_text:
                        score += 50
                
                # Car model match
                for model in keywords['car_models']:
                    if model in item_text:
                        score += 20
                
                # Keyword matches
                for kw in keywords['other_keywords']:
                    if len(kw) > 4 and kw in item_text:
                        score += 10
                
                matches.append({
                    'item_code': row['itemcode'],
                    'item_name': row['itemname'],
                    'part_number': row['part_number'],
                    'category': row['category'],
                    'car_make': row['car_make'],
                    'brand': row['brand'],
                    'packing': row['packing'],
                    'match_score': score,
                    'confidence': min(score / 100, 1.0)  # Normalize to 0-1
                })
            
            # Sort by match score
            matches.sort(key=lambda x: x['match_score'], reverse=True)
            
            cursor.close()
            conn.close()
            
            logger.info(f"🎯 Found {len(matches)} potential matches")
            return matches[:10]  # Return top 10
        
        except Exception as e:
            logger.error(f"Search error: {e}")
            if conn:
                conn.close()
            return []
    
    def identify_specific_part(self, image_data: bytes) -> Dict:
        """Main method: Identify specific part from image"""
        
        # Step 1: Extract all text from image
        extracted_texts = self.extract_all_text(image_data)
        
        # Step 2: Extract keywords
        keywords = self.extract_keywords(extracted_texts)
        
        # Step 3: Search database
        matches = self.search_specific_parts(keywords)
        
        return {
            'extracted_texts': extracted_texts,
            'keywords': keywords,
            'matches': matches,
            'match_count': len(matches),
            'best_match': matches[0] if matches else None
        }

# Initialize service
identifier = SpecificPartIdentifier()

@app.get("/")
async def root():
    return {
        "service": "Specific Part Identifier",
        "version": "3.0.0",
        "description": "Identifies EXACT auto parts using AI + OCR + Database",
        "capabilities": {
            "ocr": OCR_AVAILABLE,
            "category_ai": TF_AVAILABLE,
            "database_search": True
        }
    }

@app.post("/identify")
async def identify_part(file: UploadFile = File(...)):
    """Identify specific part from image"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await file.read()
        
        result = identifier.identify_specific_part(image_data)
        
        return {
            "success": True,
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            "result": result
        }
    
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔍 SPECIFIC AUTO PART IDENTIFIER")
    print("="*70)
    print("📝 OCR:", "✅" if OCR_AVAILABLE else "❌")
    print("🤖 AI:", "✅" if TF_AVAILABLE else "❌")
    print("💾 Database:", "✅" if get_db() else "❌")
    print("="*70)
    print("🌐 Server: http://localhost:8004")
    print("📖 Docs: http://localhost:8004/docs")
    print("="*70)
    print("\nHow it works:")
    print("1. Upload image of part")
    print("2. OCR extracts text (BOSCH, part numbers, etc.)")
    print("3. Smart search in your 2000+ items")
    print("4. Returns exact matching parts with confidence scores")
    print("="*70 + "\n")
    
    uvicorn.run(
        "specific_part_identifier:app",
        host="0.0.0.0",
        port=8004,
        reload=True
    )
