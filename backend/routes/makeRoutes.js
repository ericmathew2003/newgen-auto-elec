const express = require("express");
const router = express.Router();
const pool = require("../db");

// ➕ Add Make (with auto-generated ID)
router.post("/add", async (req, res) => {
  const { MakeName } = req.body;
  if (!MakeName) {
    return res.status(400).json({ message: "Make Name is required" });
  }
  try {
    // Get the next available MakeID
    const maxIdResult = await pool.query("SELECT COALESCE(MAX(MakeID), 0) + 1 as nextid FROM tblMasMake");
    const nextMakeID = maxIdResult.rows[0].nextid;
    
    await pool.query(
      `INSERT INTO tblMasMake (MakeID, MakeName, created_date, edited_date) 
       VALUES ($1, $2, NOW(), NOW())`,
      [nextMakeID, MakeName]
    );
    res.json({ message: "✅ Make Added", makeId: nextMakeID });
  } catch (err) {
    console.error("Error adding make:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// 📖 Get All Makes
router.get("/all", async (req, res) => {
  try {
    console.log("Fetching all makes...");
    const result = await pool.query(
      "SELECT MakeID, MakeName, created_date, edited_date FROM tblMasMake ORDER BY MakeID"
    );
    console.log(`Found ${result.rows.length} makes`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching makes:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// ❌ Delete Make (with reference checking)
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if make is referenced in tblmasitem
    const itemCheck = await pool.query(
      "SELECT COUNT(*) as count FROM tblmasitem WHERE makeid = $1",
      [id]
    );
    
    const itemCount = parseInt(itemCheck.rows[0].count);
    
    if (itemCount > 0) {
      return res.status(400).json({
        error: "Cannot delete make",
        message: `Cannot delete this make. It is currently used by ${itemCount} item${itemCount > 1 ? 's' : ''} in Item Master.`
      });
    }

    // If no references found, proceed with deletion
    const deleteResult = await pool.query("DELETE FROM tblMasMake WHERE MakeID = $1", [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Make not found" });
    }

    res.json({ message: "✅ Make deleted successfully" });
  } catch (err) {
    console.error("Delete make error:", err.message);
    res.status(500).json({ error: "DB Error: " + err.message });
  }
});

// ✏️ Edit Make
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { MakeName } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tblMasMake 
       SET MakeName = $1, edited_date = NOW() 
       WHERE MakeID = $2 
       RETURNING MakeID, MakeName, created_date, edited_date`,
      [MakeName, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Make not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating make:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
