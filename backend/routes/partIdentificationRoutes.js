const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Use memory storage — Vercel's filesystem is read-only, disk storage won't work
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// When ML_SERVICE_URL is set (hosted), parts service is at /parts prefix
const _mlBase = process.env.ML_SERVICE_URL || 'http://localhost:8007';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ? `${_mlBase}/parts` : _mlBase;
const USE_ML_SERVICE = true; // ✅ ML enabled - Hybrid service with better filtering!

// Helper function to call ML service — accepts a buffer (memory storage compatible)
async function callMLService(endpoint, fileBuffer, originalname, mimetype) {
  if (!USE_ML_SERVICE) {
    return { success: true, results: { category: 'general', confidence: 0.5, part_number: null } };
  }

  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, { filename: originalname || 'part.jpg', contentType: mimetype || 'image/jpeg' });

    const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, formData, {
      headers: { ...formData.getHeaders() },
      timeout: 30000
    });

    const data = response.data;

    if (data.success === false && data.reason === 'not_automotive_part') {
      return { success: false, filtered: true, reason: data.reason, message: data.message,
        detected_object: data.detected_object, results: { category: 'not_automotive', confidence: 0, part_number: null } };
    }

    // Any other ML-side rejection — treat as unidentified rather than hard error
    if (data.success === false) {
      return { success: true, filtered: false, results: {
        category: 'general', confidence: 0, part_number: null, inventory_matches: [] } };
    }

    if (data.success && data.your_model) {
      return { success: true, filtered: false, results: {
        category: data.your_model.category, confidence: data.your_model.confidence,
        part_number: null, inventory_matches: data.inventory_matches || [] } };
    }

    if (data.success && data.classification) {
      return { success: true, filtered: false, results: {
        category: data.classification.category, confidence: data.classification.confidence,
        part_number: data.part_number || null, inventory_matches: data.inventory_matches || [] } };
    }

    return data;
  } catch (error) {
    console.error(`ML Service Error (${endpoint}):`, error.message);
    return { success: false, error: error.message, results: { category: 'unknown', confidence: 0, part_number: null } };
  }
}

// Map ML categories to your group names
const CATEGORY_TO_GROUP_MAP = {
  'oil_filter': 'OIL FILTER',
  'air_filter': 'AIR FILTER',
  'fuel_filter': 'FUEL FILTER',
  'brake_pad': 'BRAKE PAD',
  'brake_disc': 'BRAKE PAD', // Same group
  'spark_plug': 'GENERAL',
  'clutch_plate': 'CLUTCH',
  'alternator': 'GENERAL',
  'starter_motor': 'GENERAL',
  'headlight': 'LIGHTS',
  'tail_light': 'LIGHTS',
  'wiper_blade': 'WIPER BLADE',
  'battery': 'GENERAL',
  'radiator': 'GENERAL',
  'shock_absorber': 'SHOCK ABSORBER REAR',
  'bearing': 'BEARING',  // Add bearing mapping
  'unknown': 'GENERAL'   // Fallback for low confidence
};

// Main part identification endpoint
router.post('/identify', authenticateToken, upload.single('image'), async (req, res) => {
  let client;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`Processing part identification for file: ${req.file.originalname}`);
    
    // Call ML service for identification — pass buffer directly (no disk I/O)
    let mlResult = await callMLService('/identify', req.file.buffer, req.file.originalname, req.file.mimetype);
    
    console.log('ML Service Response:', JSON.stringify(mlResult, null, 2));
    
    // Handle filtered rejection (non-automotive image)
    if (mlResult.success === false && mlResult.filtered) {
      console.log('Image rejected as non-automotive:', mlResult.reason);
      return res.status(400).json({
        success: false,
        filtered: true,
        error: 'Not an automotive part',
        message: mlResult.message || 'This image does not appear to contain automotive parts',
        reason: mlResult.reason,
        suggestion: 'Please upload an image of a car part (brake pad, filter, bearing, etc.)'
      });
    }

    // ML service error or any other failure — fall through to DB-only mode
    if (!mlResult || !mlResult.success) {
      console.log('ML service unavailable or failed, using DB fallback');
      mlResult = { success: true, results: { category: null, confidence: 0, part_number: null } };
    }
    
    // Validate ML results
    if (!mlResult.results) {
      mlResult.results = { category: null, confidence: 0, part_number: null };
    }

    const { category, confidence, part_number } = mlResult.results || {};
    
    client = await pool.connect();
    
    let partDetails = [];
    let compatibleMakes = [];
    let groupInfo = null;
    
    // Use the category as-is from ML
    let effectiveCategory = category || 'general';
    
    // Map ML category to your group name - with null safety
    const groupName = effectiveCategory 
      ? (CATEGORY_TO_GROUP_MAP[effectiveCategory] || CATEGORY_TO_GROUP_MAP[category] || effectiveCategory.toUpperCase())
      : 'GENERAL';
    
    console.log(`Identified category: ${category} -> Group: ${groupName}`);
    console.log(`Searching for group with name: "${groupName}"`);
    
    // Get group info
    const groupQuery = `
      SELECT groupid, groupname 
      FROM tblmasgroup 
      WHERE TRIM(UPPER(groupname)) = TRIM(UPPER($1))
      LIMIT 1
    `;
    
    const groupResult = await client.query(groupQuery, [groupName]);
    
    console.log(`Group query result: ${groupResult.rows.length} rows`);
    
    // If no exact match, try fuzzy search
    if (groupResult.rows.length === 0) {
      console.log(`No exact match, trying fuzzy search for: ${groupName}`);
      const fuzzyQuery = `
        SELECT groupid, groupname 
        FROM tblmasgroup 
        WHERE UPPER(groupname) LIKE '%' || UPPER($1) || '%'
        LIMIT 1
      `;
      const fuzzyResult = await client.query(fuzzyQuery, [groupName]);
      console.log(`Fuzzy search result: ${fuzzyResult.rows.length} rows`);
      if (fuzzyResult.rows.length > 0) {
        console.log(`Found group via fuzzy search: ${JSON.stringify(fuzzyResult.rows[0])}`);
        groupInfo = fuzzyResult.rows[0];
      }
    } else {
      console.log(`Found group: ${JSON.stringify(groupResult.rows[0])}`);
      groupInfo = groupResult.rows[0];
    }
    
    // Fallback: If no group found, show popular items from all groups
    if (!groupInfo) {
      console.log('No group found, showing popular items from all categories');
      
      const fallbackQuery = `
        SELECT 
          i.itemcode,
          i.itemname,
          i.partno,
          i.model,
          i.packing,
          i.barcode,
          i.sprice,
          i.mrp,
          i.curstock,
          i.unit,
          g.groupname,
          b.brandname,
          m.makename as car_make
        FROM tblmasitem i
        LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
        LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
        LEFT JOIN tblmasmake m ON i.makeid = m.makeid
        WHERE (i.deleted = false OR i.deleted IS NULL)
        ORDER BY i.curstock DESC, i.itemname
        LIMIT 20
      `;
      
      const fallbackResult = await client.query(fallbackQuery);
      partDetails = fallbackResult.rows;
      
      // Get all makes
      const allMakesQuery = `
        SELECT DISTINCT 
          m.makeid,
          m.makename,
          COUNT(i.itemcode) as parts_count
        FROM tblmasitem i
        INNER JOIN tblmasmake m ON i.makeid = m.makeid
        WHERE (i.deleted = false OR i.deleted IS NULL)
          AND m.makename IS NOT NULL
        GROUP BY m.makeid, m.makename
        ORDER BY parts_count DESC, m.makename
        LIMIT 10
      `;
      
      const allMakesResult = await client.query(allMakesQuery);
      compatibleMakes = allMakesResult.rows;
      
      console.log(`Fallback: Showing ${partDetails.length} popular items`);
    }
    
    if (groupInfo) {
      
      // Get all parts in this group with their details
      const partsQuery = `
        SELECT 
          i.itemcode,
          i.itemname,
          i.partno,
          i.model,
          i.packing,
          i.barcode,
          i.sprice,
          i.mrp,
          i.curstock,
          i.unit,
          g.groupname,
          b.brandname,
          m.makename as car_make
        FROM tblmasitem i
        LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
        LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
        LEFT JOIN tblmasmake m ON i.makeid = m.makeid
        WHERE i.groupid = $1 
          AND (i.deleted = false OR i.deleted IS NULL)
        ORDER BY i.curstock DESC, i.itemname
        LIMIT 20
      `;
      
      const partsResult = await client.query(partsQuery, [groupInfo.groupid]);
      partDetails = partsResult.rows;
      
      console.log(`Parts query returned: ${partDetails.length} parts for groupid ${groupInfo.groupid}`);
      
      // Get all unique car makes (brands) that use parts in this category
      const makesQuery = `
        SELECT DISTINCT 
          m.makeid,
          m.makename,
          COUNT(i.itemcode) as parts_count
        FROM tblmasitem i
        INNER JOIN tblmasmake m ON i.makeid = m.makeid
        WHERE i.groupid = $1 
          AND (i.deleted = false OR i.deleted IS NULL)
          AND m.makename IS NOT NULL
        GROUP BY m.makeid, m.makename
        ORDER BY parts_count DESC, m.makename
      `;
      
      const makesResult = await client.query(makesQuery, [groupInfo.groupid]);
      compatibleMakes = makesResult.rows;
    }
    
    // If part number was detected via OCR, try to find exact match
    let exactMatch = null;
    if (part_number) {
      console.log(`Searching for part number: ${part_number}`);
      
      const exactQuery = `
        SELECT 
          i.itemcode,
          i.itemname,
          i.partno,
          i.model,
          i.sprice,
          i.mrp,
          i.curstock,
          i.unit,
          g.groupname,
          b.brandname,
          m.makename as car_make
        FROM tblmasitem i
        LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
        LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
        LEFT JOIN tblmasmake m ON i.makeid = m.makeid
        WHERE (i.partno ILIKE $1 OR i.barcode = $1)
          AND i.deleted = false
        LIMIT 1
      `;
      
      const exactResult = await client.query(exactQuery, [`%${part_number}%`]);
      
      if (exactResult.rows.length > 0) {
        exactMatch = exactResult.rows[0];
        console.log(`Found exact match: ${exactMatch.itemname}`);
      }
    }
    
    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_parts,
        SUM(CASE WHEN curstock > 0 THEN 1 ELSE 0 END) as in_stock_parts,
        AVG(sprice) as avg_price,
        SUM(curstock) as total_stock
      FROM tblmasitem
      WHERE groupid = $1 AND deleted = false
    `;
    
    const statsResult = groupInfo ? 
      await client.query(statsQuery, [groupInfo.groupid]) : 
      { rows: [{ total_parts: 0, in_stock_parts: 0, avg_price: 0, total_stock: 0 }] };
    
    const stats = statsResult.rows[0];
    
    // Prepare response
    const response = {
      success: true,
      identification: {
        category: category || 'unknown',
        category_display: category 
          ? category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
          : 'Unknown',
        confidence: confidence || 0,
        group_name: groupName,
        part_number: part_number || null
      },
      exact_match: exactMatch,
      group_info: groupInfo,
      parts_in_category: partDetails.map(part => ({
        itemcode: part.itemcode,
        itemname: part.itemname,
        partno: part.partno,
        model: part.model,
        brand: part.brandname,
        car_make: part.car_make,
        price: parseFloat(part.sprice || 0),
        mrp: parseFloat(part.mrp || 0),
        stock: parseFloat(part.curstock || 0),
        stock_status: part.curstock > 10 ? 'In Stock' : 
                      part.curstock > 0 ? 'Low Stock' : 'Out of Stock',
        unit: part.unit
      })),
      compatible_makes: compatibleMakes.map(make => ({
        makeid: make.makeid,
        makename: make.makename,
        parts_available: parseInt(make.parts_count)
      })),
      statistics: {
        total_parts: parseInt(stats.total_parts),
        in_stock: parseInt(stats.in_stock_parts),
        average_price: parseFloat(stats.avg_price || 0).toFixed(2),
        total_stock: parseFloat(stats.total_stock || 0)
      },
      image_info: {
        filename: req.file.originalname,
        size: req.file.size,
        upload_time: new Date().toISOString()
      }
    };
    
    console.log(`Identification complete. Found ${partDetails.length} parts in ${compatibleMakes.length} car makes`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Error in part identification:', error);
    res.status(500).json({ 
      error: 'Failed to identify part',
      details: error.message 
    });
  } finally {
    if (client) client.release();
    // No disk file to clean up — using memory storage
  }
});

// Get parts by car make (brand)
router.get('/by-make/:makeName', authenticateToken, async (req, res) => {
  let client;
  
  try {
    const { makeName } = req.params;
    const { groupName, limit = 50 } = req.query;
    
    client = await pool.connect();
    
    let query = `
      SELECT 
        i.itemcode,
        i.itemname,
        i.partno,
        i.model,
        i.sprice,
        i.mrp,
        i.curstock,
        g.groupname,
        b.brandname,
        m.makename
      FROM tblmasitem i
      INNER JOIN tblmasmake m ON i.makeid = m.makeid
      LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
      LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
      WHERE m.makename ILIKE $1
        AND i.deleted = false
    `;
    
    const params = [`%${makeName}%`];
    
    if (groupName) {
      query += ` AND g.groupname ILIKE $2`;
      params.push(`%${groupName}%`);
    }
    
    query += ` ORDER BY i.curstock DESC, i.itemname LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await client.query(query, params);
    
    res.json({
      success: true,
      make: makeName,
      group: groupName || 'All',
      parts: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching parts by make:', error);
    res.status(500).json({ 
      error: 'Failed to fetch parts',
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// Get all car makes
router.get('/makes', authenticateToken, async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const query = `
      SELECT 
        m.makeid,
        m.makename,
        COUNT(DISTINCT i.itemcode) as total_parts,
        COUNT(DISTINCT i.groupid) as categories
      FROM tblmasmake m
      LEFT JOIN tblmasitem i ON m.makeid = i.makeid AND i.deleted = false
      GROUP BY m.makeid, m.makename
      HAVING COUNT(DISTINCT i.itemcode) > 0
      ORDER BY m.makename
    `;
    
    const result = await client.query(query);
    
    res.json({
      success: true,
      makes: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching makes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch makes',
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// Get all groups (categories)
router.get('/groups', authenticateToken, async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const query = `
      SELECT 
        g.groupid,
        g.groupname,
        COUNT(i.itemcode) as parts_count
      FROM tblmasgroup g
      LEFT JOIN tblmasitem i ON g.groupid = i.groupid AND i.deleted = false
      GROUP BY g.groupid, g.groupname
      ORDER BY g.groupname
    `;
    
    const result = await client.query(query);
    
    res.json({
      success: true,
      groups: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ 
      error: 'Failed to fetch groups',
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// Search parts
router.get('/search', authenticateToken, async (req, res) => {
  let client;
  
  try {
    const { q, make, group, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    client = await pool.connect();
    
    let query = `
      SELECT 
        i.itemcode,
        i.itemname,
        i.partno,
        i.model,
        i.sprice,
        i.mrp,
        i.curstock,
        g.groupname,
        b.brandname,
        m.makename
      FROM tblmasitem i
      LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
      LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
      LEFT JOIN tblmasmake m ON i.makeid = m.makeid
      WHERE i.deleted = false
        AND (
          i.itemname ILIKE $1 
          OR i.partno ILIKE $1 
          OR i.model ILIKE $1
          OR i.barcode = $2
        )
    `;
    
    const params = [`%${q}%`, q];
    let paramCount = 2;
    
    if (make) {
      paramCount++;
      query += ` AND m.makename ILIKE $${paramCount}`;
      params.push(`%${make}%`);
    }
    
    if (group) {
      paramCount++;
      query += ` AND g.groupname ILIKE $${paramCount}`;
      params.push(`%${group}%`);
    }
    
    paramCount++;
    query += ` ORDER BY i.curstock DESC, i.itemname LIMIT $${paramCount}`;
    params.push(limit);
    
    const result = await client.query(query, params);
    
    res.json({
      success: true,
      query: q,
      results: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error searching parts:', error);
    res.status(500).json({ 
      error: 'Failed to search parts',
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// Health check for ML service
router.get('/ml-health', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    res.json({
      success: true,
      service_url: ML_SERVICE_URL,
      service_type: 'Filtered Parts Vision',
      ml_service: response.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service_url: ML_SERVICE_URL,
      error: 'ML service unavailable',
      details: error.message
    });
  }
});

module.exports = router;
