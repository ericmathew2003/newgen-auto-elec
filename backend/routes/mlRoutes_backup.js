const express = require("express");
const router = express.Router();

// Simple test route
router.get("/health", (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Node.js ML Test',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;