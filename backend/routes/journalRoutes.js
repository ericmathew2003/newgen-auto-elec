const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

// ===== CREDIT NOTE ROUTES (using journal tables) =====

// Get next credit note serial number
router.get("/credit-notes/serial/next", authenticateToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get the last credit note serial for current year from journal_master
    const result = await pool.query(`
      SELECT journal_serial 
      FROM acc_journal_master 
      WHERE source_document_type = 'CREDIT_NOTE' 
      AND journal_serial LIKE $1
      ORDER BY journal_mas_id DESC 
      LIMIT 1
    `, [`CN-${currentYear}-%`]);
    
    let nextSerial;
    if (result.rows.length > 0) {
      const lastSerial = result.rows[0].journal_serial;
      const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      nextSerial = `CN-${currentYear}-${nextNumber}`;
    } else {
      nextSerial = `CN-${currentYear}-001`;
    }
    
    res.json({ credit_note_serial: nextSerial });
  } catch (err) {
    console.error("Error generating credit note serial:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Get all credit notes with pagination (from journal tables)
router.get("/credit-notes/all", authenticateToken, async (req, res) => {
  try {
    console.log("Credit Note API: Fetching all credit notes from journal tables...");
    
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = `WHERE jm.source_document_type = 'CREDIT_NOTE'`;
    let params = [];
    
    if (search) {
      whereClause += ` AND (
        jm.journal_serial ILIKE $1 OR 
        jm.source_document_ref ILIKE $1 OR 
        jm.narration ILIKE $1)`;
      params = [`%${search}%`];
    }
    
    console.log("Executing query with params:", params);
    console.log("WHERE clause:", whereClause);
    console.log("LIMIT:", limit, "OFFSET:", offset);
    
    // Simplified query first
    const result = await pool.query(`
      SELECT 
        jm.journal_mas_id,
        jm.journal_date,
        jm.journal_serial,
        jm.source_document_type,
        jm.source_document_ref,
        jm.total_debit,
        jm.total_credit,
        jm.narration,
        jm.created_date,
        jm.finyearid as fyear_name
      FROM acc_journal_master jm
      ${whereClause}
      ORDER BY jm.journal_date DESC, jm.journal_mas_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM acc_journal_master jm
      ${whereClause}
    `, params);
    
    console.log(`Credit Note API: Returning ${result.rows.length} credit notes`);
    res.json({
      creditNotes: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("=== DETAILED ERROR INFO ===");
    console.error("Error in /api/accounting/credit-notes/all:", err);
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Error stack:", err.stack);
    console.error("=== END ERROR INFO ===");
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      code: err.code,
      hint: "Check if journal tables exist and database connection is working"
    });
  }
});

// Create new credit note (using journal tables)
router.post("/credit-notes", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      credit_note_date,
      finyearid,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      credit_note_details
    } = req.body;

    // Validation
    if (!credit_note_date || !finyearid || !credit_note_details || credit_note_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Credit note is not balanced" });
    }

    // Generate credit note serial if not provided
    let creditNoteSerial = req.body.credit_note_serial;
    if (!creditNoteSerial) {
      const currentYear = new Date().getFullYear();
      const serialResult = await client.query(`
        SELECT journal_serial 
        FROM acc_journal_master 
        WHERE source_document_type = 'CREDIT_NOTE' 
        AND journal_serial LIKE $1
        ORDER BY journal_mas_id DESC 
        LIMIT 1
      `, [`CN-${currentYear}-%`]);
      
      if (serialResult.rows.length > 0) {
        const lastSerial = serialResult.rows[0].journal_serial;
        const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
        const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
        creditNoteSerial = `CN-${currentYear}-${nextNumber}`;
      } else {
        creditNoteSerial = `CN-${currentYear}-001`;
      }
    }

    // Insert into journal master with CREDIT_NOTE type
    const masterResult = await client.query(`
      INSERT INTO acc_journal_master (
        journal_date,
        finyearid,
        journal_serial,
        source_document_type,
        source_document_ref,
        total_debit,
        total_credit,
        narration,
        created_date,
        edited_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING journal_mas_id
    `, [
      credit_note_date,
      finyearid,
      creditNoteSerial,
      'CREDIT_NOTE',
      source_document_ref || '',
      total_debit,
      total_credit,
      narration
    ]);

    const journalMasId = masterResult.rows[0].journal_mas_id;

    // Insert into journal detail
    for (const detail of credit_note_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        journalMasId,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Credit note created successfully", 
      journal_mas_id: journalMasId,
      creditNoteSerial: creditNoteSerial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating credit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Get single credit note by ID (from journal tables)
router.get("/credit-notes/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`=== Fetching credit note with ID: ${id} ===`);
    
    // Validate ID is a number
    if (isNaN(id)) {
      console.log(`Invalid ID format: ${id}`);
      return res.status(400).json({ error: "Invalid credit note ID format" });
    }
    
    // Get master data from journal_master
    console.log("Querying journal master table for credit note...");
    const masterResult = await pool.query(`
      SELECT jm.*, 
             (SELECT p.PartyName FROM acc_journal_detail jd 
              LEFT JOIN tblMasParty p ON jd.party_id = p.PartyID 
              WHERE jd.journal_mas_id = jm.journal_mas_id 
              AND jd.party_id IS NOT NULL LIMIT 1) as party_name,
             (SELECT jd.party_id FROM acc_journal_detail jd 
              WHERE jd.journal_mas_id = jm.journal_mas_id 
              AND jd.party_id IS NOT NULL LIMIT 1) as party_id
      FROM acc_journal_master jm
      WHERE jm.journal_mas_id = $1 AND jm.source_document_type = 'CREDIT_NOTE'
    `, [parseInt(id)]);

    console.log(`Master query result: ${masterResult.rows.length} rows`);
    
    if (masterResult.rows.length === 0) {
      console.log(`No credit note found with ID: ${id}`);
      return res.status(404).json({ error: "Credit note not found" });
    }

    const masterData = masterResult.rows[0];
    console.log("Master data:", masterData);

    // Get detail data from journal_detail
    console.log("Querying journal detail table...");
    const detailResult = await pool.query(`
      SELECT jd.*, coa.account_name, p.PartyName as party_name
      FROM acc_journal_detail jd
      LEFT JOIN acc_mas_coa coa ON jd.account_id = coa.account_id
      LEFT JOIN tblMasParty p ON jd.party_id = p.PartyID
      WHERE jd.journal_mas_id = $1 
      ORDER BY jd.journal_detail_id
    `, [parseInt(id)]);

    console.log(`Detail query result: ${detailResult.rows.length} rows`);
    console.log("Detail data:", detailResult.rows);

    const response = {
      master: masterData,
      details: detailResult.rows
    };

    console.log("=== Sending credit note response ===");
    res.json(response);
    
  } catch (err) {
    console.error("=== ERROR in GET /credit-notes/:id ===");
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Error stack:", err.stack);
    
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Update credit note (using journal tables)
router.put("/credit-notes/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      credit_note_date,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      credit_note_details
    } = req.body;

    // Validation
    if (!credit_note_date || !credit_note_details || credit_note_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Credit note is not balanced" });
    }

    // Update journal master
    const masterResult = await client.query(`
      UPDATE acc_journal_master 
      SET journal_date = $1,
          source_document_ref = $2,
          total_debit = $3,
          total_credit = $4,
          narration = $5,
          edited_date = NOW()
      WHERE journal_mas_id = $6 AND source_document_type = 'CREDIT_NOTE'
      RETURNING journal_serial
    `, [
      credit_note_date,
      source_document_ref || '',
      total_debit,
      total_credit,
      narration,
      id
    ]);

    if (masterResult.rows.length === 0) {
      return res.status(404).json({ error: "Credit note not found" });
    }

    // Delete existing details from journal_detail
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);

    // Insert new details into journal_detail
    for (const detail of credit_note_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        id,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Credit note updated successfully",
      creditNoteSerial: masterResult.rows[0].journal_serial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error updating credit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Delete credit note (from journal tables)
router.delete("/credit-notes/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;

    // Check if credit note exists in journal_master
    const checkResult = await client.query(
      'SELECT journal_serial FROM acc_journal_master WHERE journal_mas_id = $1 AND source_document_type = $2',
      [id, 'CREDIT_NOTE']
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Credit note not found" });
    }

    // Delete details first (due to foreign key) from journal_detail
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);
    
    // Delete master from journal_master
    await client.query('DELETE FROM acc_journal_master WHERE journal_mas_id = $1 AND source_document_type = $2', [id, 'CREDIT_NOTE']);

    await client.query('COMMIT');
    res.json({ message: "🗑️ Credit note deleted successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting credit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// ===== DEBIT NOTE ROUTES (using journal tables) =====

// Test route to check journal table structure
router.get("/debit-notes/test", authenticateToken, async (req, res) => {
  try {
    console.log("Testing journal table structure...");
    
    // Check if journal master table exists and get its structure
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'acc_journal_master'
      ORDER BY ordinal_position;
    `);
    
    // Try a simple query
    const simpleQuery = await pool.query(`
      SELECT COUNT(*) as total_journals FROM acc_journal_master;
    `);
    
    // Check for debit notes specifically
    const debitNoteQuery = await pool.query(`
      SELECT COUNT(*) as debit_note_count 
      FROM acc_journal_master 
      WHERE source_document_type = 'DEBIT_NOTE';
    `);
    
    // Check for credit notes specifically
    const creditNoteQuery = await pool.query(`
      SELECT COUNT(*) as credit_note_count 
      FROM acc_journal_master 
      WHERE source_document_type = 'CREDIT_NOTE';
    `);
    
    // Get all journal entries with their types
    const allJournals = await pool.query(`
      SELECT journal_mas_id, journal_serial, source_document_type, journal_date
      FROM acc_journal_master 
      ORDER BY journal_mas_id DESC
      LIMIT 10;
    `);
    
    res.json({
      message: "Journal table test successful",
      table_structure: tableCheck.rows,
      total_journals: simpleQuery.rows[0].total_journals,
      debit_notes: debitNoteQuery.rows[0].debit_note_count,
      credit_notes: creditNoteQuery.rows[0].credit_note_count,
      recent_journals: allJournals.rows
    });
  } catch (err) {
    console.error("Test error:", err);
    res.status(500).json({ 
      error: "Test failed", 
      details: err.message 
    });
  }
});

// Get next debit note serial number
router.get("/debit-notes/serial/next", authenticateToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get the last debit note serial for current year from journal_master
    const result = await pool.query(`
      SELECT journal_serial 
      FROM acc_journal_master 
      WHERE source_document_type = 'DEBIT_NOTE' 
      AND journal_serial LIKE $1
      ORDER BY journal_mas_id DESC 
      LIMIT 1
    `, [`DN-${currentYear}-%`]);
    
    let nextSerial;
    if (result.rows.length > 0) {
      const lastSerial = result.rows[0].journal_serial;
      const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      nextSerial = `DN-${currentYear}-${nextNumber}`;
    } else {
      nextSerial = `DN-${currentYear}-001`;
    }
    
    res.json({ debit_note_serial: nextSerial });
  } catch (err) {
    console.error("Error generating debit note serial:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Get all debit notes with pagination (from journal tables)
router.get("/debit-notes/all", authenticateToken, async (req, res) => {
  try {
    console.log("Debit Note API: Fetching all debit notes from journal tables...");
    
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = `WHERE jm.source_document_type = 'DEBIT_NOTE'`;
    let params = [];
    
    if (search) {
      whereClause += ` AND (
        jm.journal_serial ILIKE $1 OR 
        jm.source_document_ref ILIKE $1 OR 
        jm.narration ILIKE $1)`;
      params = [`%${search}%`];
    }
    
    console.log("Executing query with params:", params);
    console.log("WHERE clause:", whereClause);
    console.log("LIMIT:", limit, "OFFSET:", offset);
    
    // Simplified query first
    const result = await pool.query(`
      SELECT 
        jm.journal_mas_id,
        jm.journal_date,
        jm.journal_serial,
        jm.source_document_type,
        jm.source_document_ref,
        jm.total_debit,
        jm.total_credit,
        jm.narration,
        jm.created_date,
        jm.finyearid as fyear_name
      FROM acc_journal_master jm
      ${whereClause}
      ORDER BY jm.journal_date DESC, jm.journal_mas_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM acc_journal_master jm
      ${whereClause}
    `, params);
    
    console.log(`Debit Note API: Returning ${result.rows.length} debit notes`);
    res.json({
      debitNotes: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("=== DETAILED ERROR INFO ===");
    console.error("Error in /api/accounting/debit-notes/all:", err);
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Error stack:", err.stack);
    console.error("=== END ERROR INFO ===");
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      code: err.code,
      hint: "Check if journal tables exist and database connection is working"
    });
  }
});

// Create new debit note (using journal tables)
router.post("/debit-notes", authenticateToken, checkPermission('ACCOUNTS_DEBIT_NOTE_ADD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      debit_note_date,
      finyearid,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      debit_note_details
    } = req.body;

    // Validation
    if (!debit_note_date || !finyearid || !debit_note_details || debit_note_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Debit note is not balanced" });
    }

    // Generate debit note serial if not provided
    let debitNoteSerial = req.body.debit_note_serial;
    if (!debitNoteSerial) {
      const currentYear = new Date().getFullYear();
      const serialResult = await client.query(`
        SELECT journal_serial 
        FROM acc_journal_master 
        WHERE source_document_type = 'DEBIT_NOTE' 
        AND journal_serial LIKE $1
        ORDER BY journal_mas_id DESC 
        LIMIT 1
      `, [`DN-${currentYear}-%`]);
      
      if (serialResult.rows.length > 0) {
        const lastSerial = serialResult.rows[0].journal_serial;
        const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
        const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
        debitNoteSerial = `DN-${currentYear}-${nextNumber}`;
      } else {
        debitNoteSerial = `DN-${currentYear}-001`;
      }
    }

    // Insert into journal master with DEBIT_NOTE type
    const masterResult = await client.query(`
      INSERT INTO acc_journal_master (
        journal_date,
        finyearid,
        journal_serial,
        source_document_type,
        source_document_ref,
        total_debit,
        total_credit,
        narration,
        created_date,
        edited_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING journal_mas_id
    `, [
      debit_note_date,
      finyearid,
      debitNoteSerial,
      'DEBIT_NOTE',
      source_document_ref || '',
      total_debit,
      total_credit,
      narration
    ]);

    const journalMasId = masterResult.rows[0].journal_mas_id;

    // Insert into journal detail
    for (const detail of debit_note_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        journalMasId,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Debit note created successfully", 
      journal_mas_id: journalMasId,
      debitNoteSerial: debitNoteSerial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating debit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Get single debit note by ID (from journal tables)
router.get("/debit-notes/:id", authenticateToken, checkPermission('ACCOUNTS_DEBIT_NOTE_VIEW'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`=== Fetching debit note with ID: ${id} ===`);
    
    // Validate ID is a number
    if (isNaN(id)) {
      console.log(`Invalid ID format: ${id}`);
      return res.status(400).json({ error: "Invalid debit note ID format" });
    }
    
    // Get master data from journal_master
    console.log("Querying journal master table...");
    const masterResult = await pool.query(`
      SELECT jm.*, 
             (SELECT p.PartyName FROM acc_journal_detail jd 
              LEFT JOIN tblMasParty p ON jd.party_id = p.PartyID 
              WHERE jd.journal_mas_id = jm.journal_mas_id 
              AND jd.party_id IS NOT NULL LIMIT 1) as party_name,
             (SELECT jd.party_id FROM acc_journal_detail jd 
              WHERE jd.journal_mas_id = jm.journal_mas_id 
              AND jd.party_id IS NOT NULL LIMIT 1) as party_id
      FROM acc_journal_master jm
      WHERE jm.journal_mas_id = $1 AND jm.source_document_type = 'DEBIT_NOTE'
    `, [parseInt(id)]);

    console.log(`Master query result: ${masterResult.rows.length} rows`);
    
    if (masterResult.rows.length === 0) {
      console.log(`No debit note found with ID: ${id}`);
      return res.status(404).json({ error: "Debit note not found" });
    }

    const masterData = masterResult.rows[0];
    console.log("Master data:", masterData);

    // Get detail data from journal_detail
    console.log("Querying journal detail table...");
    const detailResult = await pool.query(`
      SELECT jd.*, coa.account_name, p.PartyName as party_name
      FROM acc_journal_detail jd
      LEFT JOIN acc_mas_coa coa ON jd.account_id = coa.account_id
      LEFT JOIN tblMasParty p ON jd.party_id = p.PartyID
      WHERE jd.journal_mas_id = $1 
      ORDER BY jd.journal_detail_id
    `, [parseInt(id)]);

    console.log(`Detail query result: ${detailResult.rows.length} rows`);
    console.log("Detail data:", detailResult.rows);

    const response = {
      master: masterData,
      details: detailResult.rows
    };

    console.log("=== Sending response ===");
    res.json(response);
    
  } catch (err) {
    console.error("=== ERROR in GET /debit-notes/:id ===");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update debit note (using journal tables)
router.put("/debit-notes/:id", authenticateToken, checkPermission('ACCOUNTS_DEBIT_NOTE_EDIT'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      debit_note_date,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      debit_note_details
    } = req.body;

    // Validation
    if (!debit_note_date || !debit_note_details || debit_note_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Debit note is not balanced" });
    }

    // Update journal master
    const masterResult = await client.query(`
      UPDATE acc_journal_master 
      SET journal_date = $1,
          source_document_ref = $2,
          total_debit = $3,
          total_credit = $4,
          narration = $5,
          edited_date = NOW()
      WHERE journal_mas_id = $6 AND source_document_type = 'DEBIT_NOTE'
      RETURNING journal_serial
    `, [
      debit_note_date,
      source_document_ref || '',
      total_debit,
      total_credit,
      narration,
      id
    ]);

    if (masterResult.rows.length === 0) {
      return res.status(404).json({ error: "Debit note not found" });
    }

    // Delete existing details from journal_detail
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);

    // Insert new details into journal_detail
    for (const detail of debit_note_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        id,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Debit note updated successfully",
      debitNoteSerial: masterResult.rows[0].journal_serial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error updating debit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Delete debit note (from journal tables)
router.delete("/debit-notes/:id", authenticateToken, checkPermission('ACCOUNTS_DEBIT_NOTE_DELETE'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;

    // Check if debit note exists in journal_master
    const checkResult = await client.query(
      'SELECT journal_serial FROM acc_journal_master WHERE journal_mas_id = $1 AND source_document_type = $2',
      [id, 'DEBIT_NOTE']
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Debit note not found" });
    }

    // Delete details first (due to foreign key) from journal_detail
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);
    
    // Delete master from journal_master
    await client.query('DELETE FROM acc_journal_master WHERE journal_mas_id = $1 AND source_document_type = $2', [id, 'DEBIT_NOTE']);

    await client.query('COMMIT');
    res.json({ message: "🗑️ Debit note deleted successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting debit note:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// ===== JOURNAL VOUCHER ROUTES =====

// Test route to verify journal routes are working
router.get("/test", async (req, res) => {
  try {
    // Check what's in the database
    const masterCount = await pool.query('SELECT COUNT(*) as count FROM acc_journal_master');
    const detailCount = await pool.query('SELECT COUNT(*) as count FROM acc_journal_detail');
    const sampleMaster = await pool.query('SELECT * FROM acc_journal_master LIMIT 1');
    const sampleDetail = await pool.query('SELECT * FROM acc_journal_detail LIMIT 1');
    
    res.json({ 
      message: "Journal routes are working!", 
      timestamp: new Date().toISOString(),
      database_info: {
        master_records: masterCount.rows[0].count,
        detail_records: detailCount.rows[0].count,
        sample_master: sampleMaster.rows[0] || null,
        sample_detail: sampleDetail.rows[0] || null
      }
    });
  } catch (err) {
    res.json({
      message: "Journal routes working but database error",
      error: err.message
    });
  }
});

// Debug route to test fetching journal by ID
router.get("/debug/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DEBUG: Fetching journal ID ${id}`);
    
    const masterResult = await pool.query('SELECT * FROM acc_journal_master WHERE journal_mas_id = $1', [id]);
    const detailResult = await pool.query('SELECT * FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);
    
    res.json({
      debug: true,
      id: id,
      master_found: masterResult.rows.length > 0,
      master_data: masterResult.rows[0] || null,
      details_count: detailResult.rows.length,
      details_data: detailResult.rows
    });
  } catch (err) {
    res.status(500).json({
      debug: true,
      error: err.message,
      stack: err.stack
    });
  }
});

// Get all journal entries with pagination
router.get("/all", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_VIEW'), async (req, res) => {
  try {
    console.log("Journal API: Fetching all journals...");
    
    // First check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'acc_journal_master'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error("Journal table does not exist");
      return res.status(500).json({ 
        error: "Journal table not found. Please run the database migration first." 
      });
    }
    
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = `WHERE 
        jm.journal_serial ILIKE $1 OR 
        jm.source_document_ref ILIKE $1 OR 
        jm.narration ILIKE $1`;
      params = [`%${search}%`];
    }
    
    console.log("Executing query with params:", params);
    
    const result = await pool.query(`
      SELECT 
        jm.journal_mas_id,
        jm.journal_date,
        jm.journal_serial,
        jm.source_document_type,
        jm.source_document_ref,
        jm.total_debit,
        jm.total_credit,
        jm.narration,
        jm.created_date,
        jm.finyearid as fyear_name
      FROM acc_journal_master jm
      ${whereClause}
      ORDER BY jm.journal_date DESC, jm.journal_mas_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM acc_journal_master jm
      ${whereClause}
    `, params);
    
    console.log(`Journal API: Returning ${result.rows.length} journal entries`);
    res.json({
      journals: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("Error in /api/accounting/journals/all:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      hint: "Check if journal tables exist and database connection is working"
    });
  }
});

// Get next journal serial number
router.get("/serial/next", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_VIEW'), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get the last journal serial for current year
    const result = await pool.query(`
      SELECT journal_serial 
      FROM acc_journal_master 
      WHERE journal_serial LIKE $1
      ORDER BY journal_mas_id DESC 
      LIMIT 1
    `, [`JV-${currentYear}-%`]);
    
    let nextSerial;
    if (result.rows.length > 0) {
      const lastSerial = result.rows[0].journal_serial;
      const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      nextSerial = `JV-${currentYear}-${nextNumber}`;
    } else {
      nextSerial = `JV-${currentYear}-001`;
    }
    
    res.json({ journal_serial: nextSerial });
  } catch (err) {
    console.error("Error generating journal serial:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Create new journal entry
router.post("/", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_ADD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      journal_date,
      finyearid,
      source_document_type,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      journal_details
    } = req.body;

    // Validation
    if (!journal_date || !finyearid || !journal_details || journal_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Journal is not balanced" });
    }

    // Generate journal serial if not provided
    let journalSerial = req.body.journal_serial;
    if (!journalSerial) {
      const currentYear = new Date().getFullYear();
      const serialResult = await client.query(`
        SELECT journal_serial 
        FROM acc_journal_master 
        WHERE journal_serial LIKE $1
        ORDER BY journal_mas_id DESC 
        LIMIT 1
      `, [`JV-${currentYear}-%`]);
      
      if (serialResult.rows.length > 0) {
        const lastSerial = serialResult.rows[0].journal_serial;
        const lastNumber = parseInt(lastSerial.split('-')[2]) || 0;
        const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
        journalSerial = `JV-${currentYear}-${nextNumber}`;
      } else {
        journalSerial = `JV-${currentYear}-001`;
      }
    }

    // Insert journal master
    const masterResult = await client.query(`
      INSERT INTO acc_journal_master (
        journal_date,
        finyearid,
        journal_serial,
        source_document_type,
        source_document_ref,
        total_debit,
        total_credit,
        narration,
        created_date,
        edited_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING journal_mas_id
    `, [
      journal_date,
      finyearid,
      journalSerial,
      source_document_type || 'Journal',
      source_document_ref || '',
      total_debit,
      total_credit,
      narration
    ]);

    const journalMasId = masterResult.rows[0].journal_mas_id;

    // Insert journal details
    for (const detail of journal_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        journalMasId,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Journal entry created successfully", 
      journal_mas_id: journalMasId,
      journalSerial: journalSerial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating journal entry:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Get single journal entry by ID
router.get("/:id", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_VIEW'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`=== Fetching journal entry with ID: ${id} ===`);
    
    // Validate ID is a number
    if (isNaN(id)) {
      console.log(`Invalid ID format: ${id}`);
      return res.status(400).json({ error: "Invalid journal ID format" });
    }
    
    // Get master data first
    console.log("Querying master table...");
    const masterResult = await pool.query(
      'SELECT * FROM acc_journal_master WHERE journal_mas_id = $1', 
      [parseInt(id)]
    );

    console.log(`Master query result: ${masterResult.rows.length} rows`);
    
    if (masterResult.rows.length === 0) {
      console.log(`No journal found with ID: ${id}`);
      return res.status(404).json({ error: "Journal entry not found" });
    }

    const masterData = masterResult.rows[0];
    console.log("Master data:", masterData);

    // Get detail data
    console.log("Querying detail table...");
    const detailResult = await pool.query(
      'SELECT * FROM acc_journal_detail WHERE journal_mas_id = $1 ORDER BY journal_detail_id', 
      [parseInt(id)]
    );

    console.log(`Detail query result: ${detailResult.rows.length} rows`);
    console.log("Detail data:", detailResult.rows);

    const response = {
      master: masterData,
      details: detailResult.rows
    };

    console.log("=== Sending response ===");
    res.json(response);
    
  } catch (err) {
    console.error("=== ERROR in GET /:id ===");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update journal entry
router.put("/:id", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_EDIT'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      journal_date,
      source_document_type,
      source_document_ref,
      total_debit,
      total_credit,
      narration,
      journal_details
    } = req.body;

    // Validation
    if (!journal_date || !journal_details || journal_details.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (Math.abs(parseFloat(total_debit) - parseFloat(total_credit)) > 0.01) {
      return res.status(400).json({ error: "Journal is not balanced" });
    }

    // Update master
    const masterResult = await client.query(`
      UPDATE acc_journal_master 
      SET journal_date = $1,
          source_document_type = $2,
          source_document_ref = $3,
          total_debit = $4,
          total_credit = $5,
          narration = $6,
          edited_date = NOW()
      WHERE journal_mas_id = $7
      RETURNING journal_serial
    `, [
      journal_date,
      source_document_type || 'Journal',
      source_document_ref || '',
      total_debit,
      total_credit,
      narration,
      id
    ]);

    if (masterResult.rows.length === 0) {
      return res.status(404).json({ error: "Journal entry not found" });
    }

    // Delete existing details
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);

    // Insert new details
    for (const detail of journal_details) {
      await client.query(`
        INSERT INTO acc_journal_detail (
          journal_mas_id,
          account_id,
          party_id,
          debit_amount,
          credit_amount,
          description,
          allocation_ref_id,
          created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        id,
        detail.account_id,
        detail.party_id || null,
        detail.debit_amount || 0,
        detail.credit_amount || 0,
        detail.description || '',
        detail.allocation_ref_id || null
      ]);
    }

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Journal entry updated successfully",
      journalSerial: masterResult.rows[0].journal_serial
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error updating journal entry:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Delete journal entry
router.delete("/:id", authenticateToken, checkPermission('ACCOUNTS_JOURNAL_VOUCHER_DELETE'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;

    // Check if journal exists
    const checkResult = await client.query(
      'SELECT journal_serial FROM acc_journal_master WHERE journal_mas_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Journal entry not found" });
    }

    // Delete details first (due to foreign key)
    await client.query('DELETE FROM acc_journal_detail WHERE journal_mas_id = $1', [id]);
    
    // Delete master
    await client.query('DELETE FROM acc_journal_master WHERE journal_mas_id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: "🗑️ Journal entry deleted successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting journal entry:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

module.exports = router;