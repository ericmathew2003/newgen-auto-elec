const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/parts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'part-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const ML_SERVICE_URL = 'http://localhost:8002';

// Helper function to call ML service
async function callMLService(endpoint, filePath) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    
    const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error) {
    console.error(`ML Service Error (${endpoint}):`, error.message);
    throw error;
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

    console.log(`Processing part identification for file: ${req.file.filename}`);
    
    // Call ML service for identification
    const mlResult = await callMLService('/identify-part', req.file.path);
    
    if (!mlResult.success) {
      return res.status(500).json({ error: 'ML service failed to process image' });
    }

    const { category, confidence, part_number } = mlResult.results;
    
    client = await pool.connect();
    
    let partDetails = [];
    let compatibleMakes = [];
    let groupInfo = null;
    
    // If confidence is too low, try to use part number or show general results
    let effectiveCategory = category;
    if (confidence < 0.5 && !part_number) {
      console.log(`Low confidence (${confidence}), will show general results`);
      effectiveCategory = 'general';
    }
    
    // Map ML category to your group name
    const groupName = CATEGORY_TO_GROUP_MAP[effectiveCategory] || CATEGORY_TO_GROUP_MAP[category] || effectiveCategory.toUpperCase();
    
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
        category: category,
        category_display: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        confidence: confidence,
        group_name: groupName,
        part_number: part_number
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
        filename: req.file.filename,
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
    
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
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
      ml_service: response.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'ML service unavailable',
      details: error.message
    });
  }
});

module.exports = router;
