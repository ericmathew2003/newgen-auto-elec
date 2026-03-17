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
        from db_utils import get_connection
        return get_connection()
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
            # ─── ENGINE ───────────────────────────────────────────────────────
            {
                "symptoms": ["engine overheating", "temperature gauge high", "steam from hood", "coolant leak", "radiator boiling"],
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
                "symptoms": ["engine won't start", "no crank", "battery dead", "clicking sound", "dim lights", "car not starting"],
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
                "symptoms": ["engine rough idle", "shaking", "vibration", "misfiring", "poor acceleration", "engine stuttering"],
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
            {
                "symptoms": ["engine knocking", "ticking noise", "metal knocking sound", "engine rattling", "rod knock"],
                "fault": "engine_bearing_wear",
                "description": "Engine internal bearing wear causing knocking noise",
                "severity": "critical",
                "parts": ["engine_bearing", "engine_oil", "oil_pump", "crankshaft"],
                "diagnostic_steps": [
                    "Check engine oil level and pressure",
                    "Listen for knock location (top vs bottom)",
                    "Check oil pressure with gauge",
                    "Inspect oil for metal particles",
                    "Perform oil analysis"
                ]
            },
            {
                "symptoms": ["oil leak", "oil puddle under car", "burning oil smell", "blue smoke exhaust", "oil consumption high"],
                "fault": "oil_seal_failure",
                "description": "Engine oil leak from seals or gaskets",
                "severity": "medium",
                "parts": ["oil_seal", "gasket", "valve_cover_gasket", "engine_oil"],
                "diagnostic_steps": [
                    "Identify leak location with UV dye",
                    "Check valve cover gasket condition",
                    "Inspect rear main seal",
                    "Check oil pan gasket",
                    "Monitor oil level daily"
                ]
            },
            {
                "symptoms": ["white smoke exhaust", "coolant loss", "sweet smell exhaust", "milky oil", "overheating with no leak"],
                "fault": "head_gasket_failure",
                "description": "Head gasket blown causing coolant and oil mixing",
                "severity": "critical",
                "parts": ["head_gasket", "cylinder_head", "coolant"],
                "diagnostic_steps": [
                    "Check oil dipstick for milky appearance",
                    "Test coolant for combustion gases",
                    "Perform compression test",
                    "Check for bubbles in coolant reservoir",
                    "Inspect spark plugs for coolant fouling"
                ]
            },
            {
                "symptoms": ["check engine light", "engine warning light", "malfunction indicator lamp", "OBD fault code"],
                "fault": "engine_management_fault",
                "description": "Engine management system fault detected",
                "severity": "medium",
                "parts": ["oxygen_sensor", "mass_airflow_sensor", "throttle_body", "EGR_valve"],
                "diagnostic_steps": [
                    "Scan OBD-II for fault codes",
                    "Check oxygen sensor readings",
                    "Inspect mass airflow sensor",
                    "Test throttle position sensor",
                    "Check EGR valve operation"
                ]
            },

            # ─── BRAKES ───────────────────────────────────────────────────────
            {
                "symptoms": ["brake noise", "squealing", "grinding", "metallic sound when braking", "brakes screeching"],
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
                "symptoms": ["brake pedal soft", "spongy feel", "pedal goes to floor", "brake warning light", "brakes not working", "brake failure"],
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
            {
                "symptoms": ["brake vibration", "steering wheel shakes when braking", "pulsating brakes", "juddering brakes"],
                "fault": "warped_brake_disc",
                "description": "Brake disc warped causing vibration when braking",
                "severity": "medium",
                "parts": ["brake_disc", "brake_pad"],
                "diagnostic_steps": [
                    "Measure brake disc thickness variation",
                    "Check disc runout with dial gauge",
                    "Inspect disc for heat cracks",
                    "Check wheel bearing play",
                    "Road test for vibration pattern"
                ]
            },
            {
                "symptoms": ["car pulling to one side when braking", "uneven braking", "brake drag", "one wheel locking"],
                "fault": "brake_caliper_fault",
                "description": "Brake caliper seized or sticking",
                "severity": "high",
                "parts": ["brake_caliper", "brake_pad", "brake_hose"],
                "diagnostic_steps": [
                    "Check caliper slide pins for seizure",
                    "Inspect caliper piston movement",
                    "Check for uneven pad wear",
                    "Test wheel temperature after driving",
                    "Inspect brake hose for internal collapse"
                ]
            },

            # ─── TRANSMISSION / CLUTCH ────────────────────────────────────────
            {
                "symptoms": ["gear shifting hard", "difficult shifting", "transmission slipping", "delayed engagement", "gears not engaging"],
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
            {
                "symptoms": ["clutch slipping", "clutch not engaging", "clutch pedal high", "burning smell clutch", "clutch judder"],
                "fault": "clutch_wear",
                "description": "Clutch plate worn out requiring replacement",
                "severity": "high",
                "parts": ["clutch_plate", "clutch_bearing", "pressure_plate", "flywheel"],
                "diagnostic_steps": [
                    "Test clutch engagement point height",
                    "Check clutch pedal free play",
                    "Test for clutch slip under load",
                    "Inspect clutch hydraulic system",
                    "Check flywheel condition"
                ]
            },
            {
                "symptoms": ["gear slipping out", "popping out of gear", "transmission noise", "whining in gear"],
                "fault": "transmission_gear_fault",
                "description": "Transmission gear synchronizer or bearing wear",
                "severity": "high",
                "parts": ["transmission_bearing", "gear_synchronizer", "transmission_oil"],
                "diagnostic_steps": [
                    "Check transmission oil level and condition",
                    "Test all gear positions for engagement",
                    "Listen for noise in specific gears",
                    "Check gear linkage adjustment",
                    "Inspect transmission mounts"
                ]
            },

            # ─── ELECTRICAL ───────────────────────────────────────────────────
            {
                "symptoms": ["lights dim", "headlight weak", "electrical problems", "battery drains overnight", "alternator warning light"],
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
            {
                "symptoms": ["starter motor not working", "engine cranks slowly", "starter clicking", "starter grinding noise"],
                "fault": "starter_motor_failure",
                "description": "Starter motor malfunction preventing engine start",
                "severity": "high",
                "parts": ["starter_motor", "starter_solenoid", "battery"],
                "diagnostic_steps": [
                    "Test battery voltage under load",
                    "Check starter motor connections",
                    "Test starter solenoid operation",
                    "Check flywheel ring gear condition",
                    "Measure voltage drop at starter"
                ]
            },
            {
                "symptoms": ["fuse blowing", "electrical short", "burning smell electrical", "sparks from wiring", "lights flickering"],
                "fault": "electrical_short_circuit",
                "description": "Electrical short circuit in vehicle wiring",
                "severity": "critical",
                "parts": ["fuse", "relay", "wiring_harness"],
                "diagnostic_steps": [
                    "Identify which circuit is affected",
                    "Check fuse box for blown fuses",
                    "Inspect wiring for chafing or damage",
                    "Test circuit with multimeter",
                    "Check for water ingress in connectors"
                ]
            },

            # ─── STEERING ─────────────────────────────────────────────────────
            {
                "symptoms": ["steering heavy", "hard to steer", "power steering failure", "steering wheel stiff", "no power steering"],
                "fault": "power_steering_failure",
                "description": "Power steering system malfunction",
                "severity": "high",
                "parts": ["power_steering_pump", "power_steering_fluid", "steering_rack", "power_steering_belt"],
                "diagnostic_steps": [
                    "Check power steering fluid level",
                    "Inspect power steering belt condition",
                    "Test pump pressure output",
                    "Check for fluid leaks at rack",
                    "Inspect steering column joints"
                ]
            },
            {
                "symptoms": ["steering wheel vibration", "steering shimmy", "car pulling left", "car pulling right", "wheel wobble"],
                "fault": "wheel_alignment_issue",
                "description": "Wheel alignment or balance problem",
                "severity": "medium",
                "parts": ["tie_rod_end", "ball_joint", "wheel_bearing", "steering_rack"],
                "diagnostic_steps": [
                    "Check tire pressure in all wheels",
                    "Inspect tire wear pattern",
                    "Check wheel balance",
                    "Measure wheel alignment angles",
                    "Inspect tie rod ends for play"
                ]
            },
            {
                "symptoms": ["steering noise", "clunking when turning", "knocking when steering", "creaking steering"],
                "fault": "steering_joint_wear",
                "description": "Steering joints or ball joints worn",
                "severity": "high",
                "parts": ["ball_joint", "tie_rod_end", "steering_rack", "CV_joint"],
                "diagnostic_steps": [
                    "Check ball joint play with pry bar",
                    "Inspect tie rod end for looseness",
                    "Test steering rack for play",
                    "Check CV joint boots for damage",
                    "Inspect steering column universal joints"
                ]
            },

            # ─── SUSPENSION ───────────────────────────────────────────────────
            {
                "symptoms": ["car bouncing", "rough ride", "excessive body roll", "nose diving when braking", "suspension bottoming out"],
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
            {
                "symptoms": ["suspension noise", "clunking over bumps", "rattling suspension", "knocking from wheel area"],
                "fault": "suspension_component_wear",
                "description": "Suspension bushes or links worn causing noise",
                "severity": "medium",
                "parts": ["suspension_bush", "stabilizer_link", "strut_mount", "control_arm"],
                "diagnostic_steps": [
                    "Inspect anti-roll bar links",
                    "Check suspension bush condition",
                    "Test strut top mount bearing",
                    "Inspect control arm bushes",
                    "Check for loose suspension bolts"
                ]
            },
            {
                "symptoms": ["uneven tire wear", "tire wearing on inside", "tire wearing on outside", "feathering tire wear"],
                "fault": "wheel_alignment_camber",
                "description": "Incorrect wheel alignment causing uneven tire wear",
                "severity": "medium",
                "parts": ["tie_rod_end", "ball_joint", "control_arm"],
                "diagnostic_steps": [
                    "Measure camber, caster and toe angles",
                    "Check for bent suspension components",
                    "Inspect control arm bushes",
                    "Check for accident damage",
                    "Perform 4-wheel alignment"
                ]
            },

            # ─── AIR CONDITIONING ─────────────────────────────────────────────
            {
                "symptoms": ["ac not cooling", "warm air from ac", "ac compressor noise", "refrigerant leak", "ac not working"],
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
            {
                "symptoms": ["bad smell from ac", "musty smell air conditioning", "mold smell vents", "ac smell"],
                "fault": "ac_evaporator_contamination",
                "description": "AC evaporator contaminated with mold or bacteria",
                "severity": "low",
                "parts": ["ac_filter", "ac_evaporator"],
                "diagnostic_steps": [
                    "Replace cabin air filter",
                    "Clean evaporator with antibacterial spray",
                    "Check drain tube for blockage",
                    "Run AC on max for 10 minutes",
                    "Inspect evaporator housing"
                ]
            },

            # ─── FUEL SYSTEM ──────────────────────────────────────────────────
            {
                "symptoms": ["engine stalling", "fuel smell", "poor fuel economy", "hard starting", "engine hesitation"],
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
            },
            {
                "symptoms": ["black smoke exhaust", "rich fuel mixture", "fuel smell from exhaust", "excessive fuel consumption"],
                "fault": "fuel_injector_fault",
                "description": "Fuel injectors leaking or stuck open",
                "severity": "medium",
                "parts": ["fuel_injector", "fuel_pressure_regulator", "oxygen_sensor"],
                "diagnostic_steps": [
                    "Test injector balance with scan tool",
                    "Check fuel pressure regulator",
                    "Inspect injector O-rings for leaks",
                    "Test oxygen sensor readings",
                    "Check for fuel trim codes"
                ]
            },

            # ─── EXHAUST ──────────────────────────────────────────────────────
            {
                "symptoms": ["loud exhaust", "exhaust noise", "rumbling exhaust", "exhaust hole", "exhaust blowing"],
                "fault": "exhaust_system_damage",
                "description": "Exhaust system damaged or corroded",
                "severity": "medium",
                "parts": ["muffler", "exhaust_pipe", "exhaust_gasket"],
                "diagnostic_steps": [
                    "Inspect exhaust system for holes",
                    "Check exhaust manifold gasket",
                    "Inspect muffler condition",
                    "Check exhaust hangers",
                    "Test for exhaust leaks with smoke"
                ]
            },
            {
                "symptoms": ["catalytic converter smell", "sulfur smell exhaust", "rotten egg smell", "cat converter rattle"],
                "fault": "catalytic_converter_failure",
                "description": "Catalytic converter damaged or clogged",
                "severity": "medium",
                "parts": ["catalytic_converter", "oxygen_sensor"],
                "diagnostic_steps": [
                    "Check for P0420/P0430 fault codes",
                    "Test oxygen sensor before and after cat",
                    "Check exhaust back pressure",
                    "Inspect for physical damage",
                    "Test converter efficiency"
                ]
            },

            # ─── TYRES / WHEELS ───────────────────────────────────────────────
            {
                "symptoms": ["flat tyre", "tyre puncture", "tyre pressure low", "tyre deflating", "slow puncture"],
                "fault": "tyre_puncture",
                "description": "Tyre puncture or valve failure",
                "severity": "high",
                "parts": ["tyre", "tyre_valve", "wheel"],
                "diagnostic_steps": [
                    "Check tyre pressure in all wheels",
                    "Inspect tyre for nails or objects",
                    "Check valve stem for leaks",
                    "Submerge tyre in water to find leak",
                    "Inspect wheel rim for damage"
                ]
            },
            {
                "symptoms": ["wheel bearing noise", "humming noise driving", "grinding noise from wheel", "wheel noise speed related"],
                "fault": "wheel_bearing_failure",
                "description": "Wheel bearing worn causing humming or grinding noise",
                "severity": "high",
                "parts": ["wheel_bearing", "hub_assembly"],
                "diagnostic_steps": [
                    "Jack up car and spin wheel by hand",
                    "Check for play in wheel bearing",
                    "Listen for noise change when turning",
                    "Check ABS sensor ring condition",
                    "Inspect hub assembly"
                ]
            },

            # ─── COOLING SYSTEM (additional) ──────────────────────────────────
            {
                "symptoms": ["radiator leaking", "coolant dripping", "green fluid under car", "coolant puddle"],
                "fault": "radiator_leak",
                "description": "Radiator or coolant hose leaking",
                "severity": "high",
                "parts": ["radiator", "radiator_hose", "coolant", "radiator_cap"],
                "diagnostic_steps": [
                    "Pressure test cooling system",
                    "Inspect radiator for cracks",
                    "Check all hose connections",
                    "Test radiator cap pressure rating",
                    "Check water pump weep hole"
                ]
            },

            # ─── BODY / WINDOWS ───────────────────────────────────────────────
            {
                "symptoms": ["window not working", "electric window stuck", "window motor noise", "window off track"],
                "fault": "window_regulator_failure",
                "description": "Window regulator or motor failure",
                "severity": "low",
                "parts": ["glass_winder", "window_motor", "window_regulator"],
                "diagnostic_steps": [
                    "Test window switch operation",
                    "Check window motor fuse",
                    "Inspect regulator mechanism",
                    "Test motor with direct power",
                    "Check window track alignment"
                ]
            },
            {
                "symptoms": ["horn not working", "horn weak", "horn stuck on", "no horn sound"],
                "fault": "horn_failure",
                "description": "Horn malfunction",
                "severity": "low",
                "parts": ["horn", "horn_relay", "horn_fuse"],
                "diagnostic_steps": [
                    "Check horn fuse",
                    "Test horn relay",
                    "Check horn switch in steering wheel",
                    "Test horn with direct power",
                    "Inspect horn mounting and connections"
                ]
            },
            {
                "symptoms": ["wiper not working", "wiper streaking", "wiper blade worn", "wiper motor fault", "wipers not clearing"],
                "fault": "wiper_system_fault",
                "description": "Windscreen wiper system malfunction",
                "severity": "medium",
                "parts": ["wiper_blade", "wiper_motor", "wiper_linkage"],
                "diagnostic_steps": [
                    "Check wiper blade condition",
                    "Test wiper motor operation",
                    "Check wiper fuse and relay",
                    "Inspect wiper linkage",
                    "Test wiper switch"
                ]
            },

            # ─── LIGHTS ───────────────────────────────────────────────────────
            {
                "symptoms": ["headlight not working", "bulb blown", "lights not working", "indicator not working", "tail light out"],
                "fault": "lighting_failure",
                "description": "Vehicle lighting system fault",
                "severity": "medium",
                "parts": ["bulb", "lights", "fuse", "relay"],
                "diagnostic_steps": [
                    "Check bulb condition",
                    "Test fuse for lighting circuit",
                    "Check relay operation",
                    "Inspect wiring connections",
                    "Test switch operation"
                ]
            },
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
    
    # System keyword guard: maps symptom keywords -> allowed fault codes.
    # More specific keywords (longer phrases, more specific terms) take priority.
    # When multiple keywords match, the MOST SPECIFIC one wins (fewest allowed faults).
    SYSTEM_KEYWORDS = {
        # --- Cooling / Overheating (most specific — must come before "engine") ---
        "overheating": ["cooling_system_failure", "head_gasket_failure", "radiator_leak"],
        "overheat":    ["cooling_system_failure", "head_gasket_failure", "radiator_leak"],
        "coolant":     ["cooling_system_failure", "head_gasket_failure", "radiator_leak"],
        "radiator":    ["cooling_system_failure", "radiator_leak"],
        "temperature gauge": ["cooling_system_failure", "head_gasket_failure"],
        "steam":       ["cooling_system_failure", "head_gasket_failure"],
        # --- Brakes ---
        "brake":    ["brake_pad_wear", "brake_fluid_leak", "warped_brake_disc", "brake_caliper_fault"],
        "braking":  ["brake_pad_wear", "brake_fluid_leak", "warped_brake_disc", "brake_caliper_fault"],
        "squealing": ["brake_pad_wear"],
        "squeal":    ["brake_pad_wear"],
        "grinding":  ["brake_pad_wear", "wheel_bearing_failure"],
        # --- Transmission / Clutch ---
        "clutch":       ["clutch_wear", "transmission_fluid_low"],
        "gear":         ["transmission_fluid_low", "transmission_gear_fault", "clutch_wear"],
        "gearbox":      ["transmission_fluid_low", "transmission_gear_fault", "clutch_wear"],
        "transmission": ["transmission_fluid_low", "transmission_gear_fault", "clutch_wear"],
        # --- Steering ---
        "steering": ["power_steering_failure", "wheel_alignment_issue", "steering_joint_wear"],
        # --- Engine (generic — only used when no specific engine keyword matched) ---
        "engine": ["cooling_system_failure", "engine_misfire", "engine_bearing_wear",
                   "oil_seal_failure", "head_gasket_failure", "engine_management_fault",
                   "fuel_system_issue"],
        "misfire": ["engine_misfire"],
        "knocking": ["engine_bearing_wear"],
        "knock":    ["engine_bearing_wear"],
        "idle":     ["engine_misfire", "fuel_system_issue"],
        "stalling": ["fuel_system_issue", "engine_misfire"],
        "stall":    ["fuel_system_issue", "engine_misfire"],
        # --- Oil ---
        "oil leak": ["oil_seal_failure", "engine_bearing_wear"],
        "oil":      ["oil_seal_failure", "engine_bearing_wear"],
        # --- Fuel ---
        "fuel": ["fuel_system_issue", "fuel_injector_fault"],
        # --- Electrical ---
        "battery":    ["battery_charging_failure", "alternator_failure"],
        "alternator": ["alternator_failure", "battery_charging_failure"],
        "starter":    ["starter_motor_failure", "battery_charging_failure"],
        "not starting": ["battery_charging_failure", "starter_motor_failure"],
        "won't start":  ["battery_charging_failure", "starter_motor_failure"],
        "wont start":   ["battery_charging_failure", "starter_motor_failure"],
        "check engine": ["engine_management_fault"],
        "warning light": ["engine_management_fault", "brake_fluid_leak", "battery_charging_failure"],
        # --- Suspension ---
        "suspension": ["shock_absorber_wear", "suspension_component_wear", "wheel_alignment_camber"],
        "bouncing":   ["shock_absorber_wear", "suspension_component_wear"],
        "rough ride": ["shock_absorber_wear", "suspension_component_wear"],
        # --- Wheels / Tyres ---
        "tyre":     ["tyre_puncture", "wheel_bearing_failure", "wheel_alignment_issue"],
        "tire":     ["tyre_puncture", "wheel_bearing_failure", "wheel_alignment_issue"],
        "puncture": ["tyre_puncture"],
        "flat tyre": ["tyre_puncture"],
        "flat tire": ["tyre_puncture"],
        "wheel bearing": ["wheel_bearing_failure"],
        "humming":  ["wheel_bearing_failure"],
        # --- Exhaust ---
        "exhaust": ["exhaust_system_damage", "catalytic_converter_failure"],
        "smoke":   ["oil_seal_failure", "head_gasket_failure", "exhaust_system_damage"],
        # --- AC ---
        "air conditioning": ["ac_system_failure", "ac_evaporator_contamination"],
        "ac not": ["ac_system_failure"],
        # --- Misc ---
        "vibration": ["wheel_alignment_issue", "warped_brake_disc", "wheel_bearing_failure"],
        "pulling":   ["wheel_alignment_issue", "brake_caliper_fault", "tyre_puncture"],
        "window":    ["window_regulator_failure"],
        "wiper":     ["wiper_system_fault"],
        "horn":      ["horn_failure"],
        "headlight": ["lighting_failure"],
        "lights":    ["lighting_failure", "alternator_failure"],
    }

    def _allowed_faults(self, symptom: str) -> set:
        """
        Return allowed fault codes based on system keywords.
        Empty set = no restriction (symptom didn't match any keyword).
        When multiple keywords match, prefer the most specific one
        (the one with the fewest allowed faults = more targeted).
        """
        s = self._normalize(symptom)
        s_nospace = s.replace(" ", "")

        matched = []  # list of (specificity, fault_set)
        for kw, faults in self.SYSTEM_KEYWORDS.items():
            kw_norm = kw.replace(" ", "")
            hit = False
            # Substring match (handles multi-word keys like "check engine")
            if kw_norm in s_nospace or kw in s:
                hit = True
            else:
                # Stem match for single-word keywords only (>= 5 chars to avoid noise)
                if " " not in kw and len(kw_norm) >= 5:
                    for user_word in s.split():
                        if len(user_word) >= 5 and (
                            user_word.startswith(kw_norm) or kw_norm.startswith(user_word)
                        ):
                            hit = True
                            break
            if hit:
                matched.append((len(faults), set(faults)))

        if not matched:
            return set()

        # Sort by specificity: fewest faults = most specific
        matched.sort(key=lambda x: x[0])
        most_specific_count = matched[0][0]

        # Union of all matches that are equally specific (or within 2x of most specific)
        allowed = set()
        for count, faults in matched:
            if count <= most_specific_count * 2:
                allowed.update(faults)

        return allowed

    def analyze_symptoms_with_nlp(self, symptoms: List[str]) -> Dict:
        """Analyze symptoms using pretrained NLP models — each symptom diagnosed independently"""
        if not self.sentence_model or self.fault_embeddings is None:
            return self._fallback_analysis(symptoms)
        
        try:
            seen_faults = {}  # fault_code -> best result

            # Diagnose each symptom independently
            for symptom in symptoms:
                symptom_text = symptom.lower()
                allowed = self._allowed_faults(symptom_text)
                symptom_embedding = self.sentence_model.encode([symptom_text])
                similarities = cosine_similarity(symptom_embedding, self.fault_embeddings)[0]
                top_indices = np.argsort(similarities)[-5:][::-1]

                for idx in top_indices:
                    similarity_score = float(similarities[idx])
                    fault = self.automotive_knowledge_base[idx]
                    fault_code = fault["fault"]
                    # Apply system keyword guard
                    if allowed and fault_code not in allowed:
                        continue
                    if similarity_score > 0.45:
                        fault = self.automotive_knowledge_base[idx]
                        fault_code = fault["fault"]
                        if fault_code not in seen_faults or similarity_score > seen_faults[fault_code]["confidence"]:
                            seen_faults[fault_code] = {
                                "fault": fault_code,
                                "description": fault["description"],
                                "confidence": similarity_score,
                                "severity": fault["severity"],
                                "parts": fault["parts"],
                                "diagnostic_steps": fault["diagnostic_steps"],
                                "triggered_by": symptom
                            }

            # Also run combined to catch cross-symptom patterns
            if len(symptoms) > 1:
                combined_text = " ".join(symptoms).lower()
                combined_embedding = self.sentence_model.encode([combined_text])
                similarities = cosine_similarity(combined_embedding, self.fault_embeddings)[0]
                top_indices = np.argsort(similarities)[-5:][::-1]

                for idx in top_indices:
                    similarity_score = float(similarities[idx])
                    if similarity_score > 0.50:
                        fault = self.automotive_knowledge_base[idx]
                        fault_code = fault["fault"]
                        if fault_code not in seen_faults or similarity_score > seen_faults[fault_code]["confidence"]:
                            seen_faults[fault_code] = {
                                "fault": fault_code,
                                "description": fault["description"],
                                "confidence": similarity_score,
                                "severity": fault["severity"],
                                "parts": fault["parts"],
                                "diagnostic_steps": fault["diagnostic_steps"],
                                "triggered_by": "combined symptoms"
                            }

            predicted_faults = sorted(seen_faults.values(), key=lambda x: x["confidence"], reverse=True)

            return {
                "method": "pretrained_nlp",
                "predicted_faults": predicted_faults,
                "symptom_analysis": {
                    "processed_text": " | ".join(symptoms),
                    "faults_detected": len(predicted_faults)
                }
            }
        
        except Exception as e:
            logger.error(f"NLP analysis failed: {e}")
            return self._fallback_analysis(symptoms)
    
    def _normalize(self, text: str) -> str:
        """Normalize text: lowercase, collapse spaces, remove punctuation"""
        import re
        text = text.lower().strip()
        text = re.sub(r'[^\w\s]', ' ', text)   # remove punctuation
        text = re.sub(r'\s+', ' ', text)         # collapse whitespace
        return text

    @staticmethod
    def _word_in_text(word: str, text: str) -> bool:
        """Check if a word appears in text, with basic plural/singular handling."""
        if word in text:
            return True
        # singular -> plural: "brake" matches "brakes"
        if (word + "s") in text:
            return True
        # plural -> singular: "brakes" matches "brake"
        if word.endswith("s") and word[:-1] in text:
            return True
        return False

    def _symptom_matches(self, kb_symptom: str, user_input: str) -> bool:
        """
        Check if a knowledge-base symptom phrase matches user input.
        Rules applied in order — returns True on first match.
        """
        kb = self._normalize(kb_symptom)
        user = self._normalize(user_input)

        # 1. Direct substring match
        if kb in user:
            return True

        # 2. Space-collapsed match (handles "over heating" vs "overheating")
        if kb.replace(" ", "") in user.replace(" ", ""):
            return True

        # 3. All significant words present (with plural/singular tolerance)
        kb_words = [w for w in kb.split() if len(w) > 3]
        if kb_words and all(self._word_in_text(w, user) for w in kb_words):
            return True

        # 4. Stem match for longer words only (>= 6 chars) to avoid false positives
        #    e.g. "overheat" matches "overheating", but "brake" does NOT match "brakes" here
        user_words = [w for w in user.split() if len(w) > 3]
        for kb_word in kb_words:
            for user_word in user_words:
                if min(len(kb_word), len(user_word)) >= 6:
                    if user_word.startswith(kb_word) or kb_word.startswith(user_word):
                        return True

        return False

    def _score_fault_match(self, fault: Dict, symptom: str) -> float:
        """
        Score how well a fault matches a symptom.
        Uses weighted scoring: longer/more-specific KB symptom phrases score higher
        than short single-word matches, preventing generic words like 'brake' from
        matching every brake-related fault equally.
        """
        symptom_lower = symptom.lower()
        total_weight = 0.0
        matched_weight = 0.0

        for kb_symptom in fault["symptoms"]:
            # Weight = number of significant words in the KB phrase
            # e.g. "brake pedal soft spongy feel" (5 words) > "brake noise" (2 words)
            words = [w for w in kb_symptom.split() if len(w) > 3]
            weight = max(1.0, len(words) * 1.5)
            total_weight += weight
            if self._symptom_matches(kb_symptom, symptom_lower):
                matched_weight += weight

        if total_weight == 0:
            return 0.0
        return matched_weight / total_weight

    def _fallback_analysis(self, symptoms: List[str]) -> Dict:
        """
        Fallback keyword matching — scores faults by weighted phrase specificity,
        then applies a minimum threshold so generic single-word matches don't flood results.
        """
        seen_faults = {}

        for symptom in symptoms:
            symptom_lower = symptom.lower()
            allowed = self._allowed_faults(symptom_lower)

            fault_scores = []
            for fault in self.automotive_knowledge_base:
                fault_code = fault["fault"]
                if allowed and fault_code not in allowed:
                    continue
                score = self._score_fault_match(fault, symptom_lower)
                if score > 0:
                    fault_scores.append((fault, score))

            if not fault_scores:
                continue

            # Dynamic threshold: only keep faults scoring >= 40% of the best match.
            # Note: keyword scores are naturally low (a single phrase match out of many
            # gives ~10-30%), so we use a relative threshold rather than an absolute one.
            best_score = max(s for _, s in fault_scores)
            min_threshold = best_score * 0.4

            for fault, score in fault_scores:
                if score < min_threshold:
                    continue
                fault_code = fault["fault"]
                if fault_code not in seen_faults or score > seen_faults[fault_code]["confidence"]:
                    seen_faults[fault_code] = {
                        "fault": fault_code,
                        "description": fault["description"],
                        "confidence": round(score, 4),
                        "severity": fault["severity"],
                        "parts": fault["parts"],
                        "diagnostic_steps": fault["diagnostic_steps"],
                        "triggered_by": symptom
                    }

        # Also check combined text for cross-symptom patterns (multiple symptoms only)
        if len(symptoms) > 1:
            combined = " ".join(symptoms)
            fault_scores = []
            for fault in self.automotive_knowledge_base:
                score = self._score_fault_match(fault, combined)
                if score > 0:
                    fault_scores.append((fault, score))

            if fault_scores:
                best_score = max(s for _, s in fault_scores)
                min_threshold = best_score * 0.4
                for fault, score in fault_scores:
                    if score < min_threshold:
                        continue
                    fault_code = fault["fault"]
                    if fault_code not in seen_faults or score > seen_faults[fault_code]["confidence"]:
                        seen_faults[fault_code] = {
                            "fault": fault_code,
                            "description": fault["description"],
                            "confidence": round(score, 4),
                            "severity": fault["severity"],
                            "parts": fault["parts"],
                            "diagnostic_steps": fault["diagnostic_steps"],
                            "triggered_by": "combined symptoms"
                        }

        matches = sorted(seen_faults.values(), key=lambda x: x["confidence"], reverse=True)

        return {
            "method": "keyword_matching",
            "predicted_faults": matches,
            "symptom_analysis": {
                "processed_text": " | ".join(symptoms),
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