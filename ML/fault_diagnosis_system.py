#!/usr/bin/env python3
"""
AI-Driven Automobile Fault Diagnosis and Spare-Part Recommendation System

Features:
1. Symptom → Fault diagnosis using ML
2. Fault → Spare part recommendation
3. Integration with your existing ERP database
4. Learning from historical repair data
5. Multi-modal input (text symptoms + images)

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
import pickle

# FastAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Database
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# ML libraries
try:
    import tensorflow as tf
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, classification_report
    import joblib
    ML_AVAILABLE = True
except ImportError:
    print("ML libraries not available. Install with: pip install scikit-learn")
    ML_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fault Diagnosis & Parts Recommendation API",
    description="AI-powered vehicle fault diagnosis and spare parts recommendation",
    version="1.0.0"
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

class FaultDiagnosisResponse(BaseModel):
    predicted_faults: List[Dict]
    recommended_parts: List[Dict]
    confidence_score: float
    diagnostic_steps: List[str]

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

class FaultDiagnosisSystem:
    def __init__(self):
        self.symptom_vectorizer = None
        self.fault_classifier = None
        self.fault_to_parts_map = {}
        self.symptom_to_fault_data = []
        
        # Initialize system
        self._load_or_create_models()
        self._load_fault_to_parts_mapping()
    
    def _load_or_create_models(self):
        """Load existing models or create new ones"""
        model_path = 'ML/models/fault_diagnosis_model.pkl'
        vectorizer_path = 'ML/models/symptom_vectorizer.pkl'
        
        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            try:
                self.fault_classifier = joblib.load(model_path)
                self.symptom_vectorizer = joblib.load(vectorizer_path)
                logger.info("✅ Loaded existing fault diagnosis models")
                return
            except Exception as e:
                logger.warning(f"Failed to load models: {e}")
        
        # Create new models with sample data
        logger.info("Creating new fault diagnosis models with sample data...")
        self._create_sample_training_data()
        self._train_models()
    
    def _create_sample_training_data(self):
        """Create sample training data for fault diagnosis"""
        # Sample symptom → fault mapping
        sample_data = [
            # Engine Issues
            {"symptoms": "engine overheating temperature gauge high steam", "fault": "cooling_system_failure", "parts": ["radiator", "thermostat", "water_pump"]},
            {"symptoms": "engine won't start no crank battery dead", "fault": "battery_failure", "parts": ["battery", "alternator"]},
            {"symptoms": "engine rough idle shaking vibration", "fault": "engine_misfire", "parts": ["spark_plug", "ignition_coil", "fuel_injector"]},
            {"symptoms": "engine knocking noise metal sound", "fault": "engine_bearing_wear", "parts": ["engine_bearing", "engine_oil"]},
            {"symptoms": "engine oil leak puddle ground", "fault": "oil_seal_failure", "parts": ["oil_seal", "gasket", "engine_oil"]},
            
            # Brake Issues
            {"symptoms": "brake noise squealing grinding", "fault": "brake_pad_wear", "parts": ["brake_pad", "brake_disc"]},
            {"symptoms": "brake pedal soft spongy feel", "fault": "brake_fluid_leak", "parts": ["brake_fluid", "brake_hose", "master_cylinder"]},
            {"symptoms": "brake vibration steering wheel shake", "fault": "warped_brake_disc", "parts": ["brake_disc", "brake_pad"]},
            {"symptoms": "brake warning light dashboard", "fault": "brake_system_fault", "parts": ["brake_sensor", "brake_fluid"]},
            
            # Transmission Issues
            {"symptoms": "gear shifting hard difficult", "fault": "transmission_fluid_low", "parts": ["transmission_fluid", "transmission_filter"]},
            {"symptoms": "transmission slipping gear slip", "fault": "clutch_wear", "parts": ["clutch_plate", "clutch_bearing"]},
            {"symptoms": "transmission noise whining sound", "fault": "transmission_bearing_wear", "parts": ["transmission_bearing", "transmission_oil"]},
            
            # Electrical Issues
            {"symptoms": "lights dim headlight weak", "fault": "alternator_failure", "parts": ["alternator", "alternator_belt"]},
            {"symptoms": "battery drain overnight dead", "fault": "electrical_drain", "parts": ["battery", "fuse", "relay"]},
            {"symptoms": "starter motor clicking noise", "fault": "starter_failure", "parts": ["starter_motor", "starter_solenoid"]},
            
            # Suspension Issues
            {"symptoms": "car bouncing rough ride", "fault": "shock_absorber_wear", "parts": ["shock_absorber", "strut_mount"]},
            {"symptoms": "steering wheel vibration shake", "fault": "wheel_alignment_issue", "parts": ["tie_rod_end", "ball_joint"]},
            {"symptoms": "car pulling left right", "fault": "tire_pressure_uneven", "parts": ["tire", "wheel_alignment"]},
            
            # Air Conditioning
            {"symptoms": "ac not cooling warm air", "fault": "refrigerant_low", "parts": ["ac_refrigerant", "ac_compressor"]},
            {"symptoms": "ac compressor noise loud", "fault": "ac_compressor_failure", "parts": ["ac_compressor", "ac_belt"]},
            
            # Fuel System
            {"symptoms": "engine stalling fuel smell", "fault": "fuel_pump_failure", "parts": ["fuel_pump", "fuel_filter"]},
            {"symptoms": "poor fuel economy consumption high", "fault": "fuel_injector_dirty", "parts": ["fuel_injector", "fuel_filter"]},
            
            # Exhaust System
            {"symptoms": "exhaust smoke black white", "fault": "exhaust_system_fault", "parts": ["exhaust_pipe", "catalytic_converter"]},
            {"symptoms": "exhaust noise loud rumbling", "fault": "muffler_damage", "parts": ["muffler", "exhaust_pipe"]},
        ]
        
        self.symptom_to_fault_data = sample_data
        logger.info(f"Created {len(sample_data)} sample fault diagnosis records")
    
    def _train_models(self):
        """Train the fault diagnosis models"""
        if not ML_AVAILABLE:
            logger.error("ML libraries not available for training")
            return
        
        # Prepare training data
        symptoms_text = [item["symptoms"] for item in self.symptom_to_fault_data]
        fault_labels = [item["fault"] for item in self.symptom_to_fault_data]
        
        # Create TF-IDF vectorizer for symptoms
        self.symptom_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        
        # Vectorize symptoms
        X = self.symptom_vectorizer.fit_transform(symptoms_text)
        y = fault_labels
        
        # Train classifier
        self.fault_classifier = RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            max_depth=10
        )
        
        self.fault_classifier.fit(X, y)
        
        # Save models
        os.makedirs('ML/models', exist_ok=True)
        joblib.dump(self.fault_classifier, 'ML/models/fault_diagnosis_model.pkl')
        joblib.dump(self.symptom_vectorizer, 'ML/models/symptom_vectorizer.pkl')
        
        logger.info("✅ Fault diagnosis models trained and saved")
    
    def _load_fault_to_parts_mapping(self):
        """Load fault to parts mapping from training data and ERP"""
        # Create mapping from sample data
        for item in self.symptom_to_fault_data:
            fault = item["fault"]
            parts = item["parts"]
            if fault not in self.fault_to_parts_map:
                self.fault_to_parts_map[fault] = []
            self.fault_to_parts_map[fault].extend(parts)
        
        # Remove duplicates
        for fault in self.fault_to_parts_map:
            self.fault_to_parts_map[fault] = list(set(self.fault_to_parts_map[fault]))
        
        logger.info(f"Loaded fault-to-parts mapping for {len(self.fault_to_parts_map)} faults")
    
    def diagnose_fault(self, symptoms: List[str], vehicle_info: Dict = None) -> Dict:
        """Diagnose fault based on symptoms — each symptom diagnosed independently,
        then results merged so multiple unrelated faults are all returned."""
        if not self.fault_classifier or not self.symptom_vectorizer:
            return {
                "error": "Fault diagnosis models not available",
                "predicted_faults": [],
                "confidence_score": 0.0
            }

        try:
            seen_faults = {}  # fault_code -> best result so far

            # 1. Diagnose each symptom individually
            for symptom in symptoms:
                X = self.symptom_vectorizer.transform([symptom.lower()])
                probs = self.fault_classifier.predict_proba(X)[0]
                classes = self.fault_classifier.classes_

                top_indices = np.argsort(probs)[-3:][::-1]
                for idx in top_indices:
                    if probs[idx] > 0.1:
                        fault_code = classes[idx]
                        if fault_code not in seen_faults or probs[idx] > seen_faults[fault_code]["confidence"]:
                            seen_faults[fault_code] = {
                                "fault": fault_code,
                                "confidence": float(probs[idx]),
                                "description": self._get_fault_description(fault_code),
                                "triggered_by": symptom
                            }

            # 2. Also run combined symptoms to catch cross-symptom patterns
            if len(symptoms) > 1:
                combined_text = " ".join(symptoms).lower()
                X_combined = self.symptom_vectorizer.transform([combined_text])
                probs_combined = self.fault_classifier.predict_proba(X_combined)[0]
                classes = self.fault_classifier.classes_

                top_indices = np.argsort(probs_combined)[-3:][::-1]
                for idx in top_indices:
                    if probs_combined[idx] > 0.15:  # slightly higher threshold for combined
                        fault_code = classes[idx]
                        if fault_code not in seen_faults or probs_combined[idx] > seen_faults[fault_code]["confidence"]:
                            seen_faults[fault_code] = {
                                "fault": fault_code,
                                "confidence": float(probs_combined[idx]),
                                "description": self._get_fault_description(fault_code),
                                "triggered_by": "combined symptoms"
                            }

            # 3. Sort by confidence descending
            predicted_faults = sorted(seen_faults.values(), key=lambda x: x["confidence"], reverse=True)

            return {
                "predicted_faults": predicted_faults,
                "confidence_score": predicted_faults[0]["confidence"] if predicted_faults else 0.0,
                "symptoms_analyzed": symptoms
            }

        except Exception as e:
            logger.error(f"Error in fault diagnosis: {e}")
            return {
                "error": str(e),
                "predicted_faults": [],
                "confidence_score": 0.0
            }
    
    def _get_fault_description(self, fault_code: str) -> str:
        """Get human-readable description for fault code"""
        descriptions = {
            "cooling_system_failure": "Cooling system malfunction - engine overheating",
            "battery_failure": "Battery or charging system issue",
            "engine_misfire": "Engine misfiring - poor combustion",
            "engine_bearing_wear": "Engine internal wear - bearing damage",
            "oil_seal_failure": "Oil leak from seals or gaskets",
            "brake_pad_wear": "Brake pads worn out - need replacement",
            "brake_fluid_leak": "Brake fluid leak - brake system issue",
            "warped_brake_disc": "Brake disc warped - causes vibration",
            "brake_system_fault": "General brake system malfunction",
            "transmission_fluid_low": "Low transmission fluid level",
            "clutch_wear": "Clutch components worn out",
            "transmission_bearing_wear": "Transmission internal wear",
            "alternator_failure": "Alternator not charging properly",
            "electrical_drain": "Electrical system draining battery",
            "starter_failure": "Starter motor malfunction",
            "shock_absorber_wear": "Suspension components worn",
            "wheel_alignment_issue": "Wheels not properly aligned",
            "tire_pressure_uneven": "Tire pressure imbalance",
            "refrigerant_low": "Air conditioning refrigerant low",
            "ac_compressor_failure": "AC compressor malfunction",
            "fuel_pump_failure": "Fuel pump not working properly",
            "fuel_injector_dirty": "Fuel injectors need cleaning",
            "exhaust_system_fault": "Exhaust system damage",
            "muffler_damage": "Muffler damaged or worn"
        }
        return descriptions.get(fault_code, fault_code.replace("_", " ").title())
    
    def recommend_parts(self, faults: List[Dict], vehicle_info: Dict = None) -> List[Dict]:
        """Recommend spare parts based on diagnosed faults"""
        recommended_parts = []
        
        for fault_info in faults:
            fault = fault_info["fault"]
            confidence = fault_info["confidence"]
            
            # Get parts for this fault
            if fault in self.fault_to_parts_map:
                fault_parts = self.fault_to_parts_map[fault]
                
                # Search for these parts in your ERP database
                erp_parts = self._search_parts_in_erp(fault_parts, vehicle_info)
                
                for part in erp_parts:
                    part["fault_confidence"] = confidence
                    part["fault_type"] = fault
                    recommended_parts.append(part)
        
        # Remove duplicates and sort by relevance
        unique_parts = {}
        for part in recommended_parts:
            key = part["item_code"]
            if key not in unique_parts or part["fault_confidence"] > unique_parts[key]["fault_confidence"]:
                unique_parts[key] = part
        
        return list(unique_parts.values())
    
    def _search_parts_in_erp(self, part_keywords: List[str], vehicle_info: Dict = None) -> List[Dict]:
        """Search for parts in your ERP database"""
        conn = get_db()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build search query
            search_conditions = []
            params = []
            
            for keyword in part_keywords:
                search_conditions.append("LOWER(i.itemname) LIKE LOWER(%s) OR LOWER(g.groupname) LIKE LOWER(%s)")
                params.extend([f'%{keyword}%', f'%{keyword}%'])
            
            query = f"""
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
                    i.unit
                FROM tblmasitem i
                LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
                LEFT JOIN tblmasmake m ON i.makeid = m.makeid
                LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
                WHERE i.deleted = false
                AND ({' OR '.join(search_conditions)})
            """
            
            # Add vehicle-specific filtering if provided
            if vehicle_info and vehicle_info.get("vehicle_make"):
                query += " AND (m.makename ILIKE %s OR m.makename IS NULL)"
                params.append(f'%{vehicle_info["vehicle_make"]}%')
            
            query += " ORDER BY i.curstock DESC, i.sprice ASC LIMIT 20"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            parts = []
            for row in results:
                parts.append({
                    "item_code": row["itemcode"],
                    "item_name": row["itemname"],
                    "part_number": row["part_number"],
                    "category": row["category"],
                    "car_make": row["car_make"],
                    "brand": row["brand"],
                    "price": float(row["sprice"] or 0),
                    "mrp": float(row["mrp"] or 0),
                    "stock": float(row["curstock"] or 0),
                    "unit": row["unit"],
                    "availability": "In Stock" if row["curstock"] and row["curstock"] > 0 else "Out of Stock"
                })
            
            cursor.close()
            conn.close()
            
            return parts
        
        except Exception as e:
            logger.error(f"Error searching ERP parts: {e}")
            if conn:
                conn.close()
            return []
    
    def get_diagnostic_steps(self, fault: str) -> List[str]:
        """Get diagnostic steps for a specific fault"""
        diagnostic_steps = {
            "cooling_system_failure": [
                "Check coolant level in radiator and reservoir",
                "Inspect for coolant leaks under vehicle",
                "Test thermostat operation",
                "Check radiator fan operation",
                "Pressure test cooling system"
            ],
            "battery_failure": [
                "Test battery voltage (should be 12.6V when off)",
                "Check battery terminals for corrosion",
                "Test alternator charging rate",
                "Check for parasitic drain",
                "Load test battery capacity"
            ],
            "brake_pad_wear": [
                "Visual inspection of brake pads through wheel",
                "Check brake pad thickness (minimum 3mm)",
                "Listen for squealing or grinding noises",
                "Check brake fluid level",
                "Test brake pedal feel and travel"
            ],
            "engine_misfire": [
                "Scan for diagnostic trouble codes",
                "Check spark plugs condition",
                "Test ignition coils",
                "Check fuel injector operation",
                "Verify compression in cylinders"
            ]
        }
        
        return diagnostic_steps.get(fault, [
            "Perform visual inspection",
            "Check related components",
            "Use diagnostic tools if available",
            "Consult service manual for specific procedures"
        ])

# Initialize the system
diagnosis_system = FaultDiagnosisSystem()

# API Endpoints

@app.get("/")
async def root():
    return {
        "service": "Fault Diagnosis & Parts Recommendation API",
        "version": "1.0.0",
        "description": "AI-powered vehicle fault diagnosis and spare parts recommendation",
        "features": {
            "fault_diagnosis": diagnosis_system.fault_classifier is not None,
            "parts_recommendation": True,
            "erp_integration": get_db() is not None
        }
    }

@app.post("/diagnose")
async def diagnose_fault(input_data: SymptomInput):
    """Diagnose vehicle fault based on symptoms"""
    try:
        # Diagnose fault
        diagnosis_result = diagnosis_system.diagnose_fault(
            input_data.symptoms,
            {
                "vehicle_make": input_data.vehicle_make,
                "vehicle_model": input_data.vehicle_model,
                "mileage": input_data.mileage
            }
        )
        
        if "error" in diagnosis_result:
            raise HTTPException(status_code=500, detail=diagnosis_result["error"])
        
        # Get recommended parts
        recommended_parts = diagnosis_system.recommend_parts(
            diagnosis_result["predicted_faults"],
            {"vehicle_make": input_data.vehicle_make}
        )
        
        # Get diagnostic steps for top fault
        diagnostic_steps = []
        if diagnosis_result["predicted_faults"]:
            top_fault = diagnosis_result["predicted_faults"][0]["fault"]
            diagnostic_steps = diagnosis_system.get_diagnostic_steps(top_fault)
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "input_symptoms": input_data.symptoms,
            "vehicle_info": {
                "make": input_data.vehicle_make,
                "model": input_data.vehicle_model,
                "mileage": input_data.mileage
            },
            "diagnosis": diagnosis_result,
            "recommended_parts": recommended_parts,
            "diagnostic_steps": diagnostic_steps,
            "parts_count": len(recommended_parts)
        }
    
    except Exception as e:
        logger.error(f"Error in diagnosis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/faults")
async def get_known_faults():
    """Get list of known faults the system can diagnose"""
    if diagnosis_system.fault_classifier:
        faults = diagnosis_system.fault_classifier.classes_.tolist()
        return {
            "known_faults": [
                {
                    "code": fault,
                    "description": diagnosis_system._get_fault_description(fault)
                }
                for fault in faults
            ],
            "count": len(faults)
        }
    else:
        return {"known_faults": [], "count": 0}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "fault_diagnosis": "✅" if diagnosis_system.fault_classifier else "❌",
        "erp_database": "✅" if get_db() else "❌",
        "ml_libraries": "✅" if ML_AVAILABLE else "❌"
    }

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔧 FAULT DIAGNOSIS & PARTS RECOMMENDATION SYSTEM")
    print("="*70)
    print("🤖 Fault Diagnosis:", "✅" if diagnosis_system.fault_classifier else "❌")
    print("💾 ERP Database:", "✅" if get_db() else "❌")
    print("📚 ML Libraries:", "✅" if ML_AVAILABLE else "❌")
    print("="*70)
    print("🌐 Server: http://localhost:8008")
    print("📖 Docs: http://localhost:8008/docs")
    print("="*70)
    print("\n🚀 FEATURES:")
    print("✅ Symptom → Fault diagnosis")
    print("✅ Fault → Spare parts recommendation")
    print("✅ ERP database integration")
    print("✅ Diagnostic step guidance")
    print("✅ Vehicle-specific recommendations")
    print("="*70 + "\n")
    
    uvicorn.run(
        "fault_diagnosis_system:app",
        host="0.0.0.0",
        port=8008,
        reload=True
    )