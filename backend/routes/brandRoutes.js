const express = require("express");
const router = express.Router();
const pool = require("../db");

// ➕ Add Brand (with auto-generated ID)
router.post("/add", async (req, res) => {
  const { BrandName } = req.body;
  if (!BrandName) {
    return res.status(400).json({ message: "Brand Name is required" });
  }
  try {
    // Get the next available BrandID
    const maxIdResult = await pool.query("SELECT COALESCE(MAX(BrandID), 0) + 1 as nextid FROM tblMasBrand");
    const nextBrandID = maxIdResult.rows[0].nextid;
    
    await pool.query(
      "INSERT INTO tblMasBrand (BrandID, BrandName, created_date, edited_date) VALUES ($1, $2, NOW(), NOW())",
      [nextBrandID, BrandName]
    );
    res.json({ message: "✅ Brand Added", brandId: nextBrandID });
  } catch (err) {
    console.error("Error adding brand:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// 📖 Get All Brands
router.get("/all", async (req, res) => {
  try {
    console.log("Fetching all brands...");
    const result = await pool.query("SELECT BrandID, BrandName, created_date, edited_date FROM tblMasBrand ORDER BY BrandID");
    console.log(`Found ${result.rows.length} brands`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching brands:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// ❌ Delete Brand (with reference checking)
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if brand is referenced in tblmasitem
    const itemCheck = await pool.query(
      "SELECT COUNT(*) as count FROM tblmasitem WHERE brandid = $1",
      [id]
    );
    
    const itemCount = parseInt(itemCheck.rows[0].count);
    
    if (itemCount > 0) {
      return res.status(400).json({
        error: "Cannot delete brand",
        message: `Cannot delete this brand. It is currently used by ${itemCount} item${itemCount > 1 ? 's' : ''} in Item Master.`
      });
    }

    // If no references found, proceed with deletion
    const deleteResult = await pool.query("DELETE FROM tblMasBrand WHERE BrandID = $1", [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.json({ message: "✅ Brand deleted successfully" });
  } catch (err) {
    console.error("Delete brand error:", err.message);
    res.status(500).json({ error: "DB Error: " + err.message });
  }
});

// edit
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { BrandName } = req.body;
  try {
    const result = await pool.query(
      "UPDATE tblMasBrand SET BrandName = $1, edited_date = NOW() WHERE BrandID = $2 RETURNING *",
      [BrandName, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating brand:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
