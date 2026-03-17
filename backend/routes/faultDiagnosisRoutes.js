const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const FAULT_DIAGNOSIS_SERVICE_URL = process.env.ML_SERVICE_URL 
  ? `${process.env.ML_SERVICE_URL}/fault`
  : 'http://localhost:8009';

// Diagnose fault based on symptoms
router.post('/diagnose', authenticateToken, async (req, res) => {
  try {
    const { symptoms, vehicle_make, vehicle_model, mileage, additional_info } = req.body;

    // Validate input
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ 
        error: 'Symptoms are required and must be a non-empty array' 
      });
    }

    console.log(`Processing fault diagnosis for symptoms: ${symptoms.join(', ')}`);

    // Call fault diagnosis service
    const response = await axios.post(`${FAULT_DIAGNOSIS_SERVICE_URL}/diagnose`, {
      symptoms: symptoms.filter(s => s && s.trim()), // Remove empty symptoms
      vehicle_make,
      vehicle_model,
      mileage,
      additional_info
    }, {
      timeout: 30000
    });

    console.log('Fault diagnosis completed successfully');
    res.json(response.data);

  } catch (error) {
    console.error('Error in fault diagnosis:', error);
    
    if (error.response) {
      // Service returned an error
      res.status(error.response.status).json({
        error: 'Fault diagnosis service error',
        details: error.response.data
      });
    } else if (error.code === 'ECONNREFUSED') {
      // Service not available
      res.status(503).json({
        error: 'Fault diagnosis service unavailable',
        details: 'Please ensure the fault diagnosis service is running on port 8008'
      });
    } else {
      // Other errors
      res.status(500).json({
        error: 'Failed to diagnose fault',
        details: error.message
      });
    }
  }
});

// Get list of known faults
router.get('/faults', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${FAULT_DIAGNOSIS_SERVICE_URL}/faults`, {
      timeout: 10000
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching known faults:', error);
    res.status(500).json({
      error: 'Failed to fetch known faults',
      details: error.message
    });
  }
});

// Health check for fault diagnosis service
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${FAULT_DIAGNOSIS_SERVICE_URL}/health`, {
      timeout: 5000
    });

    res.json({
      success: true,
      service_url: FAULT_DIAGNOSIS_SERVICE_URL,
      service_status: response.data
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      service_url: FAULT_DIAGNOSIS_SERVICE_URL,
      error: 'Fault diagnosis service unavailable',
      details: error.message
    });
  }
});

module.exports = router;