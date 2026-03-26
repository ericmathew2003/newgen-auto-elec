const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const FAULT_DIAGNOSIS_SERVICE_URL = process.env.ML_SERVICE_URL
  ? `${process.env.ML_SERVICE_URL}/fault`
  : 'http://localhost:8001/fault';

// Render free tier sleeps after inactivity — wake it up before the real call
async function wakeUpService() {
  try {
    const baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    await axios.get(`${baseUrl}/health`, { timeout: 60000 });
  } catch (_) {
    // Ignore — just warming up
  }
}

// Diagnose fault based on symptoms
router.post('/diagnose', authenticateToken, async (req, res) => {
  try {
    const { symptoms, vehicle_make, vehicle_model, mileage, additional_info } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        error: 'Symptoms are required and must be a non-empty array',
      });
    }

    console.log(`Processing fault diagnosis for symptoms: ${symptoms.join(', ')}`);

    // Wake up Render service if it's sleeping (free tier cold start can take ~30s)
    await wakeUpService();

    const response = await axios.post(
      `${FAULT_DIAGNOSIS_SERVICE_URL}/diagnose`,
      {
        symptoms: symptoms.filter((s) => s && s.trim()),
        vehicle_make,
        vehicle_model,
        mileage,
        additional_info,
      },
      { timeout: 90000 } // 90s to handle cold starts
    );

    console.log('Fault diagnosis completed successfully');
    res.json(response.data);

  } catch (error) {
    console.error('Error in fault diagnosis:', error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: 'Fault diagnosis service error',
        details: error.response.data,
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Fault diagnosis service unavailable',
        details: 'ML service is not running',
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(503).json({
        error: 'ML service is starting up',
        details: 'The service was sleeping. Please try again in a few seconds.',
        retry: true,
      });
    } else {
      res.status(500).json({
        error: 'Failed to diagnose fault',
        details: error.message,
      });
    }
  }
});

// Get list of known faults
router.get('/faults', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${FAULT_DIAGNOSIS_SERVICE_URL}/faults`, {
      timeout: 60000,
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching known faults:', error.message);
    res.status(500).json({
      error: 'Failed to fetch known faults',
      details: error.message,
    });
  }
});

// Health check
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${FAULT_DIAGNOSIS_SERVICE_URL}/health`, {
      timeout: 60000,
    });
    res.json({
      success: true,
      service_url: FAULT_DIAGNOSIS_SERVICE_URL,
      service_status: response.data,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service_url: FAULT_DIAGNOSIS_SERVICE_URL,
      error: 'Fault diagnosis service unavailable',
      details: error.message,
    });
  }
});

module.exports = router;
