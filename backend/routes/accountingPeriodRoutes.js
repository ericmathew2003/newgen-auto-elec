const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * Get All Accounting Periods
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT FinYearID, FinYearName, FYDateFrom, FYDateTo 
       FROM tblFinYear 
       ORDER BY FinYearID DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch accounting periods" });
  }
});

module.exports = router;




