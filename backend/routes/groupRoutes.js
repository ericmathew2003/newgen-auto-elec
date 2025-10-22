const express = require("express");
const router = express.Router();
const pool = require("../db");

// ➕ Add Group (with auto-generated ID)
router.post("/add", async (req, res) => {
  const { GroupName } = req.body;
  if (!GroupName) {
    return res.status(400).json({ message: "Group Name is required" });
  }
  try {
    // Get the next available GroupID
    const maxIdResult = await pool.query("SELECT COALESCE(MAX(GroupID), 0) + 1 as nextid FROM tblMasGroup");
    const nextGroupID = maxIdResult.rows[0].nextid;
    
    await pool.query(
      `INSERT INTO tblMasGroup (GroupID, GroupName, created_date, edited_date) 
       VALUES ($1, $2, NOW(), NOW())`,
      [nextGroupID, GroupName]
    );
    res.json({ message: "✅ Group Added", groupId: nextGroupID });
  } catch (err) {
    console.error("Error adding group:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// 📖 Get All Groups
router.get("/all", async (req, res) => {
  try {
    console.log("Fetching all groups...");
    const result = await pool.query(
      "SELECT GroupID, GroupName, created_date, edited_date FROM tblMasGroup ORDER BY GroupID"
    );
    console.log(`Found ${result.rows.length} groups`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// ❌ Delete Group (with reference checking)
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if group is referenced in tblmasitem
    const itemCheck = await pool.query(
      "SELECT COUNT(*) as count FROM tblmasitem WHERE groupid = $1",
      [id]
    );
    
    const itemCount = parseInt(itemCheck.rows[0].count);
    
    if (itemCount > 0) {
      return res.status(400).json({
        error: "Cannot delete group",
        message: `Cannot delete this group. It is currently used by ${itemCount} item${itemCount > 1 ? 's' : ''} in Item Master.`
      });
    }

    // If no references found, proceed with deletion
    const deleteResult = await pool.query("DELETE FROM tblMasGroup WHERE GroupID = $1", [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ message: "✅ Group deleted successfully" });
  } catch (err) {
    console.error("Delete group error:", err.message);
    res.status(500).json({ error: "DB Error: " + err.message });
  }
});

// ✏️ Edit Group
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { GroupName } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tblMasGroup 
       SET GroupName = $1, edited_date = NOW() 
       WHERE GroupID = $2 
       RETURNING *`,
      [GroupName, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating group:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
