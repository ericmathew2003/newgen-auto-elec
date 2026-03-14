#!/usr/bin/env python3
"""
Advanced AI Fault Diagnosis System using Pretrained NLP Models

Features:
1. HuggingFace Transformers for symptom understanding
2. BERT-based text classification
3. Sentence similarity for fault matching
4. Automotive knowledge base integration
5. ERP spare parts mapping

Author: AI Assistant
Date: 2024
"""

import os
import re
import json
import numpy as np
import pandas as pd
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

# FastAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Database
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Pretrained NLP Models
try:
    from transformers import pipeline, AutoTokenizer, AutoModel
    from sentence_transformers import SentenceTransformer
    import torch
    NLP_AVAILABLE = True
except ImportError:
    print("Transformers not available. Install with: pip install transformers sentence-transformers torch")
    NLP_AVAILABLE = False

# Traditional ML for fallback
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Advanced AI Fault Diagnosis API",
    description="Pretrained NLP models for automotive fault diagnosis",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class SymptomInput(BaseModel):
    symptoms: List[str]
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    mileage: Optional[int] = None
    additional_info: Optional[str] = None

def get_db():
    try:
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'newgen'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'eric@123')
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

class AdvancedFaultDiagnosisSystem:
    def __init__(self):
        # NLP Models
        self.symptom_classifier = None
        self.sentence_model = None
        self.similarity_model = None
        
        # Knowledge base
        self.automotive_knowledge_base = []
        self.fault_embeddings = None
        
        # Initialize system
        self._load_automotive_knowledge_base()
        self._initialize_nlp_models()
    
    def _load_automotive_knowledge_base(self):
        """Load comprehensive automotive fault knowledge base"""
        self.automotive_knowledge_base = [
            # Engine Issues
            {
                "symptoms": ["engine overheating", "temperature gauge high", "steam from hood", "coolant leak"],
                "fault": "cooling_system_failure",
                "description": "Cooling system malfunction causing engine overheating",
                "severity": "high",
                "parts": ["radiator", "thermostat", "water_pump", "coolant", "radiator_hose"],
                "diagnostic_steps": [
                    "Check coolant level in radiator and reservoir",
                    "Inspect for coolant leaks under vehicle",
                    "Test thermostat operation with temperature gun",
                    "Check radiator fan operation",
                    "Pressure test cooling system for leaks"
                ]
            },
            {
                "symptoms": ["engine won't start", "no crank", "battery dead", "clicking sound", "dim lights"],
                "fault": "battery_charging_failure",
                "description": "Battery or charging system malfunction",
                "severity": "high",
                "parts": ["battery", "alternator", "starter_motor", "battery_cables"],
                "diagnostic_steps": [
                    "Test battery voltage (should be 12.6V when off)",
                    "Check battery terminals for corrosion",
                    "Test alternator charging rate (13.5-14.5V when running)",
                    "Check for parasitic drain",
                    "Load test battery capacity"
                ]
            },
            {
                "symptoms": ["engine rough idle", "shaking", "vibration", "misfiring", "poor acceleration"],
                "fault": "engine_misfire",
                "description": "Engine misfiring due to ignition or fuel system issues",
                "severity": "medium",
                "parts": ["spark_plug", "ignition_coil", "fuel_injector", "air_filter", "fuel_filter"],
                "diagnostic_steps": [
                    "Scan for diagnostic trouble codes (DTCs)",
                    "Check spark plugs condition and gap",
                    "Test ignition coils with multimeter",
                    "Check fuel injector operation",
                    "Verify compression in all cylinders"
                ]
            },
            
            # Brake Issues
            {
                "symptoms": ["brake noise", "squealing", "grinding", "metallic sound when braking"],
                "fault": "brake_pad_wear",
                "description": "Brake pads worn beyond safe limits",
                "severity": "high",
                "parts": ["brake_pad", "brake_disc", "brake_fluid"],
                "diagnostic_steps": [
                    "Visual inspection of brake pads through wheel",
                    "Measure brake pad thickness (minimum 3mm)",
                    "Check brake disc condition for scoring",
                    "Inspect brake fluid level and color",
                    "Test brake pedal feel and travel"
                ]
            },
            {
                "symptoms": ["brake pedal soft", "spongy feel", "pedal goes to floor", "brake warning light"],
                "fault": "brake_fluid_leak",
                "description": "Brake fluid leak causing loss of braking pressure",
                "severity": "critical",
                "parts": ["brake_fluid", "brake_hose", "master_cylinder", "brake_caliper"],
                "diagnostic_steps": [
                    "Check brake fluid reservoir level",
                    "Inspect brake lines for leaks",
                    "Test brake pedal for firmness",
                    "Check brake fluid color (should be clear/amber)",
                    "Pressure test brake system"
                ]
            },
            
            # Transmission Issues
            {
                "symptoms": ["gear shifting hard", "difficult shifting", "transmission slipping", "delayed engagement"],
                "fault": "transmission_fluid_low",
                "description": "Low transmission fluid affecting gear operation",
                "severity": "medium",
                "parts": ["transmission_fluid", "transmission_filter", "transmission_gasket"],
                "diagnostic_steps": [
                    "Check transmission fluid level with engine running",
                    "Inspect fluid color (should be red/pink)",
                    "Check for transmission fluid leaks",
                    "Test shift quality during road test",
                    "Scan for transmission trouble codes"
                ]
            },
            
            # Electrical Issues
            {
                "symptoms": ["lights dim", "headlight weak", "electrical problems", "battery drains overnight"],
                "fault": "alternator_failure",
                "description": "Alternator not charging battery properly",
                "severity": "high",
                "parts": ["alternator", "alternator_belt", "voltage_regulator"],
                "diagnostic_steps": [
                    "Test charging voltage at battery terminals",
                    "Check alternator belt tension and condition",
                    "Test alternator output under load",
                    "Inspect electrical connections",
                    "Check for warning lights on dashboard"
                ]
            },
            
            # Suspension Issues
            {
                "symptoms": ["car bouncing", "rough ride", "excessive body roll", "nose diving when braking"],
                "fault": "shock_absorber_wear",
                "description": "Worn shock absorbers affecting ride quality",
                "severity": "medium",
                "parts": ["shock_absorber", "strut_mount", "suspension_spring"],
                "diagnostic_steps": [
                    "Visual inspection of shock absorbers for leaks",
                    "Bounce test - push down on each corner",
                    "Check for uneven tire wear patterns",
                    "Inspect suspension mounting points",
                    "Road test for handling characteristics"
                ]
            },
            
            # Air Conditioning
            {
                "symptoms": ["ac not cooling", "warm air", "ac compressor noise", "refrigerant leak"],
                "fault": "ac_system_failure",
                "description": "Air conditioning system malfunction",
                "severity": "low",
                "parts": ["ac_compressor", "ac_refrigerant", "ac_filter", "ac_belt"],
                "diagnostic_steps": [
                    "Check AC refrigerant pressure",
                    "Inspect AC compressor operation",
                    "Test AC clutch engagement",
                    "Check cabin air filter condition",
                    "Inspect AC system for leaks"
                ]
            },
            
            # Fuel System
            {
                "symptoms": ["engine stalling", "fuel smell", "poor fuel economy", "hard starting"],
                "fault": "fuel_system_issue",
                "description": "Fuel delivery or quality problems",
                "severity": "medium",
                "parts": ["fuel_pump", "fuel_filter", "fuel_injector", "fuel_pressure_regulator"],
                "diagnostic_steps": [
                    "Test fuel pressure at rail",
                    "Check fuel pump operation",
                    "Inspect fuel filter condition",
                    "Test fuel injector spray pattern",
                    "Check for fuel system leaks"
                ]
            }
        ]
        
        logger.info(f"Loaded {len(self.automotive_knowledge_base)} fault patterns")
    
    def _initialize_nlp_models(self):
        """Initialize pretrained NLP models"""
        if not NLP_AVAILABLE:
            logger.warning("NLP models not available")
            return
        
        try:
            logger.info("Loading pretrained NLP models...")
            
            # 1. Sentence transformer for semantic similarity
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Sentence transformer loaded")
            
            # 2. Text classification pipeline
            self.symptom_classifier = pipeline(
                "text-classification",
                model="distilbert-base-uncased",
                return_all_scores=True
            )
            logger.info("✅ Text classifier loaded")
            
            # 3. Precompute embeddings for fault knowledge base
            self._precompute_fault_embeddings()
            
        except Exception as e:
            logger.error(f"Failed to load NLP models: {e}")
            self.sentence_model = None
            self.symptom_classifier = None
    
    def _precompute_fault_embeddings(self):
        """Precompute embeddings for all fault patterns"""
        if not self.sentence_model:
            return
        
        try:
            fault_texts = []
            for fault in self.automotive_knowledge_base:
                # Combine symptoms and description for better matching
                text = " ".join(fault["symptoms"]) + " " + fault["description"]
                fault_texts.append(text)
            
            # Compute embeddings
            self.fault_embeddings = self.sentence_model.encode(fault_texts)
            logger.info(f"✅ Precomputed embeddings for {len(fault_texts)} fault patterns")
            
        except Exception as e:
            logger.error(f"Failed to precompute embeddings: {e}")
    
    def analyze_symptoms_with_nlp(self, symptoms: List[str]) -> Dict:
        """Analyze symptoms using pretrained NLP models"""
        if not self.sentence_model or self.fault_embeddings is None:
            return self._fallback_analysis(symptoms)
        
        try:
            # Combine all symptoms into one text
            symptom_text = " ".join(symptoms).lower()
            logger.info(f"Processing symptoms: {symptom_text}")
            
            # Get embedding for user symptoms
            symptom_embedding = self.sentence_model.encode([symptom_text])
            logger.info(f"Generated embedding shape: {symptom_embedding.shape}")
            
            # Calculate similarity with all fault patterns
            similarities = cosine_similarity(symptom_embedding, self.fault_embeddings)[0]
            logger.info(f"Similarities shape: {similarities.shape}, type: {type(similarities)}")
            
            # Get top 3 matches
            top_indices = np.argsort(similarities)[-3:][::-1]
            logger.info(f"Top indices: {top_indices}, type: {type(top_indices)}")
            
            predicted_faults = []
            for i, idx in enumerate(top_indices):
                similarity_score = float(similarities[idx])
                logger.info(f"Processing index {i}: idx={idx}, similarity={similarity_score}")
                if similarity_score > 0.3:  # Minimum similarity threshold
                    fault = self.automotive_knowledge_base[idx]
                    predicted_faults.append({
                        "fault": fault["fault"],
                        "description": fault["description"],
                        "confidence": similarity_score,
                        "severity": fault["severity"],
                        "parts": fault["parts"],
                        "diagnostic_steps": fault["diagnostic_steps"]
                    })
            
            # Safe way to get top similarity
            top_similarity = 0.0
            if top_indices.size > 0:
                top_similarity = float(similarities[top_indices[0]])
            
            return {
                "method": "pretrained_nlp",
                "predicted_faults": predicted_faults,
                "symptom_analysis": {
                    "processed_text": symptom_text,
                    "embedding_size": len(symptom_embedding[0]),
                    "top_similarity": top_similarity
                }
            }
        
        except Exception as e:
            logger.error(f"NLP analysis failed: {e}")
            return self._fallback_analysis(symptoms)
    
    def _fallback_analysis(self, symptoms: List[str]) -> Dict:
        """Fallback analysis using keyword matching"""
        symptom_text = " ".join(symptoms).lower()
        
        matches = []
        for fault in self.automotive_knowledge_base:
            score = 0
            for symptom in fault["symptoms"]:
                if symptom.lower() in symptom_text:
                    score += 1
            
            if score > 0:
                confidence = score / len(fault["symptoms"])
                matches.append({
                    "fault": fault["fault"],
                    "description": fault["description"],
                    "confidence": confidence,
                    "severity": fault["severity"],
                    "parts": fault["parts"],
                    "diagnostic_steps": fault["diagnostic_steps"]
                })
        
        # Sort by confidence
        matches.sort(key=lambda x: x["confidence"], reverse=True)
        
        return {
            "method": "keyword_matching",
            "predicted_faults": matches[:3],
            "symptom_analysis": {
                "processed_text": symptom_text,
                "keyword_matches": len(matches)
            }
        }
    
    def search_parts_in_erp(self, parts_list: List[str], vehicle_info: Dict = None) -> List[Dict]:
        """Search for parts in ERP database with intelligent vehicle-specific matching"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            all_parts = []
            vehicle_make = vehicle_info.get("vehicle_make", "").strip() if vehicle_info else ""
            vehicle_model = vehicle_info.get("vehicle_model", "").strip() if vehicle_info else ""
            
            logger.info(f"Searching parts for: {parts_list}, Vehicle: {vehicle_make} {vehicle_model}")
            
            for part_keyword in parts_list:
                # Enhanced search query with intelligent prioritization
                query = """
                    SELECT 
                        i.itemcode,
                        i.itemname,
                        i.suppref as part_number,
                        g.groupname as category,
                        m.makename as car_make,
                        b.brandname as brand,
                        i.sprice,
                        i.mrp,
                        i.curstock,
                        i.unit,
                        %s as search_keyword,
                        -- Scoring for intelligent ranking
                        (
                            CASE 
                                -- Exact vehicle model match gets highest priority
                                WHEN LOWER(i.itemname) LIKE LOWER(%s) AND LOWER(i.itemname) LIKE LOWER(%s) THEN 100
                                -- Vehicle make match with part keyword
                                WHEN LOWER(m.makename) LIKE LOWER(%s) AND (
                                    LOWER(i.itemname) LIKE LOWER(%s) 
                                    OR LOWER(g.groupname) LIKE LOWER(%s)
                                ) THEN 90
                                -- Part keyword match with stock available
                                WHEN (LOWER(i.itemname) LIKE LOWER(%s) OR LOWER(g.groupname) LIKE LOWER(%s)) 
                                     AND i.curstock > 0 THEN 80
                                -- Part keyword match without stock
                                WHEN LOWER(i.itemname) LIKE LOWER(%s) OR LOWER(g.groupname) LIKE LOWER(%s) THEN 70
                                -- Universal parts (no specific make)
                                WHEN m.makename IS NULL AND (
                                    LOWER(i.itemname) LIKE LOWER(%s) 
                                    OR LOWER(g.groupname) LIKE LOWER(%s)
                                ) THEN 60
                                ELSE 0
                            END
                        ) as relevance_score
                    FROM tblmasitem i
                    LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                    LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                    LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                    WHERE i.deleted = false
                    AND (
                        -- Match part keyword in item name or category
                        LOWER(i.itemname) LIKE LOWER(%s) 
                        OR LOWER(g.groupname) LIKE LOWER(%s)
                        OR LOWER(i.suppref) LIKE LOWER(%s)
                        -- Also match vehicle-specific parts
                        OR (LOWER(i.itemname) LIKE LOWER(%s) AND LOWER(i.itemname) LIKE LOWER(%s))
                    )
                    ORDER BY 
                        relevance_score DESC,
                        CASE WHEN i.curstock > 0 THEN 1 ELSE 2 END,  -- Stock available first
                        i.curstock DESC,  -- Higher stock first
                        i.sprice ASC      -- Lower price first
                    LIMIT 8
                """
                
                # Prepare search patterns
                part_pattern = f'%{part_keyword}%'
                make_pattern = f'%{vehicle_make}%' if vehicle_make else '%'
                model_pattern = f'%{vehicle_model}%' if vehicle_model else '%'
                
                params = [
                    part_keyword,  # search_keyword
                    model_pattern, part_pattern,  # Exact vehicle model match
                    make_pattern, part_pattern, part_pattern,  # Vehicle make match
                    part_pattern, part_pattern,  # Part with stock
                    part_pattern, part_pattern,  # Part without stock
                    part_pattern, part_pattern,  # Universal parts
                    part_pattern, part_pattern, part_pattern,  # Main search conditions
                    make_pattern, model_pattern   # Vehicle-specific search
                ]
                
                cursor.execute(query, params)
                results = cursor.fetchall()
                
                logger.info(f"Found {len(results)} parts for '{part_keyword}'")
                
                for row in results:
                    # Calculate availability status
                    stock = float(row["curstock"] or 0)
                    availability = "In Stock" if stock > 0 else "Out of Stock"
                    
                    # Add priority flag for exact vehicle matches
                    is_vehicle_specific = False
                    item_name_lower = (row["itemname"] or "").lower()
                    if vehicle_model and vehicle_model.lower() in item_name_lower:
                        is_vehicle_specific = True
                    
                    part_data = {
                        "item_code": row["itemcode"],
                        "item_name": row["itemname"],
                        "part_number": row["part_number"],
                        "category": row["category"],
                        "car_make": row["car_make"],
                        "brand": row["brand"],
                        "price": float(row["sprice"] or 0),
                        "mrp": float(row["mrp"] or 0),
                        "stock": stock,
                        "unit": row["unit"],
                        "search_keyword": row["search_keyword"],
                        "availability": availability,
                        "relevance_score": float(row["relevance_score"] or 0),
                        "is_vehicle_specific": is_vehicle_specific
                    }
                    
                    all_parts.append(part_data)
            
            cursor.close()
            conn.close()
            
            # Remove duplicates and sort by relevance
            unique_parts = {}
            for part in all_parts:
                key = part["item_code"]
                if key not in unique_parts or part["relevance_score"] > unique_parts[key]["relevance_score"]:
                    unique_parts[key] = part
            
            # Sort final results by relevance score and stock availability
            sorted_parts = sorted(
                unique_parts.values(), 
                key=lambda x: (x["relevance_score"], x["stock"], -x["price"]), 
                reverse=True
            )
            
            logger.info(f"Returning {len(sorted_parts)} unique parts")
            return sorted_parts[:10]  # Return top 10 most relevant parts
        
        except Exception as e:
            logger.error(f"ERP search error: {e}")
            if conn:
                conn.close()
            return []
    
    def diagnose_fault(self, symptoms: List[str], vehicle_info: Dict = None) -> Dict:
        """Main diagnosis method using advanced NLP"""
        
        logger.info(f"Starting diagnosis for symptoms: {symptoms}")
        logger.info(f"Vehicle info: {vehicle_info}")
        
        # Step 1: Analyze symptoms with NLP
        logger.info("Step 1: Analyzing symptoms with NLP")
        analysis_result = self.analyze_symptoms_with_nlp(symptoms)
        logger.info(f"Analysis result: {analysis_result}")
        
        # Step 2: Get recommended parts from all predicted faults
        logger.info("Step 2: Getting recommended parts")
        all_parts = []
        for fault in analysis_result["predicted_faults"]:
            logger.info(f"Processing fault: {fault['fault']}")
            parts = self.search_parts_in_erp(fault["parts"], vehicle_info)
            for part in parts:
                part["fault_type"] = fault["fault"]
                part["fault_confidence"] = fault["confidence"]
                part["severity"] = fault["severity"]
            all_parts.extend(parts)
        
        # Step 3: Get diagnostic steps from top fault
        logger.info("Step 3: Getting diagnostic steps")
        diagnostic_steps = []
        if analysis_result["predicted_faults"]:
            diagnostic_steps = analysis_result["predicted_faults"][0]["diagnostic_steps"]
        
        logger.info("Diagnosis completed successfully")
        return {
            "analysis_method": analysis_result["method"],
            "predicted_faults": analysis_result["predicted_faults"],
            "recommended_parts": all_parts,
            "diagnostic_steps": diagnostic_steps,
            "symptom_analysis": analysis_result["symptom_analysis"],
            "nlp_available": NLP_AVAILABLE
        }

# Initialize the advanced system
advanced_diagnosis = AdvancedFaultDiagnosisSystem()

# API Endpoints

@app.get("/")
async def root():
    return {
        "service": "Advanced AI Fault Diagnosis API",
        "version": "2.0.0",
        "description": "Pretrained NLP models for automotive fault diagnosis",
        "features": {
            "pretrained_nlp": NLP_AVAILABLE,
            "sentence_transformers": advanced_diagnosis.sentence_model is not None,
            "automotive_knowledge_base": len(advanced_diagnosis.automotive_knowledge_base),
            "erp_integration": get_db() is not None
        }
    }

@app.post("/diagnose")
async def diagnose_advanced(input_data: SymptomInput):
    """Advanced fault diagnosis using pretrained NLP models"""
    try:
        result = advanced_diagnosis.diagnose_fault(
            input_data.symptoms,
            {
                "vehicle_make": input_data.vehicle_make,
                "vehicle_model": input_data.vehicle_model,
                "mileage": input_data.mileage
            }
        )
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "input_symptoms": input_data.symptoms,
            "vehicle_info": {
                "make": input_data.vehicle_make,
                "model": input_data.vehicle_model,
                "mileage": input_data.mileage
            },
            "diagnosis": result,
            "parts_count": len(result["recommended_parts"])
        }
    
    except Exception as e:
        logger.error(f"Advanced diagnosis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge-base")
async def get_knowledge_base():
    """Get automotive knowledge base statistics"""
    return {
        "total_fault_patterns": len(advanced_diagnosis.automotive_knowledge_base),
        "fault_categories": list(set([f["fault"] for f in advanced_diagnosis.automotive_knowledge_base])),
        "nlp_models_loaded": {
            "sentence_transformer": advanced_diagnosis.sentence_model is not None,
            "text_classifier": advanced_diagnosis.symptom_classifier is not None,
            "embeddings_computed": advanced_diagnosis.fault_embeddings is not None
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "nlp_models": "✅" if NLP_AVAILABLE else "❌ Install: pip install transformers sentence-transformers torch",
        "knowledge_base": f"✅ {len(advanced_diagnosis.automotive_knowledge_base)} patterns",
        "database": "✅" if get_db() else "❌"
    }

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🧠 ADVANCED AI FAULT DIAGNOSIS SYSTEM")
    print("="*70)
    print("🤖 Pretrained NLP Models:", "✅" if NLP_AVAILABLE else "❌")
    print("📚 Knowledge Base:", f"{len(advanced_diagnosis.automotive_knowledge_base)} patterns")
    print("🔍 Sentence Similarity:", "✅" if advanced_diagnosis.sentence_model else "❌")
    print("💾 Database:", "✅" if get_db() else "❌")
    print("="*70)
    print("🌐 Server: http://localhost:8009")
    print("📖 Docs: http://localhost:8009/docs")
    print("="*70)
    print("\n🚀 ADVANCED FEATURES:")
    print("✅ HuggingFace Transformers for symptom understanding")
    print("✅ Sentence-BERT for semantic similarity")
    print("✅ Comprehensive automotive knowledge base")
    print("✅ Intelligent ERP parts mapping")
    print("✅ Severity-based fault prioritization")
    print("="*70 + "\n")
    
    uvicorn.run(
        "advanced_fault_diagnosis:app",
        host="0.0.0.0",
        port=8009,
        reload=True
    )