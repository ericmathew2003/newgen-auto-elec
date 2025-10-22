const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get company profile (first row)
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT company_name, address_line1, address_line2, city, state, gst_number, phone_number1, email
       FROM public.tbl_company
       ORDER BY 1
       LIMIT 1`
    );
    if (!r.rows || r.rows.length === 0) {
      return res.status(404).json({ error: "Company profile not found" });
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch company profile" });
  }
});

module.exports = router;