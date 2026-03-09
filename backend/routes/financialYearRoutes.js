const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// Get all financial years
router.get('/', authenticateToken, checkPermission('Settings_Financial Year_View'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                fy.finyearid,
                fy.finyearname,
                fy.fydatefrom,
                fy.fydateto,
                COUNT(fp.period_id) as period_count,
                SUM(CASE WHEN fp.status = 'Open' THEN 1 ELSE 0 END) as open_periods
            FROM public.tblfinyear fy
            LEFT JOIN public.acc_financial_period fp ON fy.finyearid = fp.finyearid
            GROUP BY fy.finyearid, fy.finyearname, fy.fydatefrom, fy.fydateto
            ORDER BY fy.fydatefrom DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching financial years:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get financial periods for a year
router.get('/:yearId/periods', authenticateToken, checkPermission('Settings_Financial Year_View'), async (req, res) => {
    try {
        const { yearId } = req.params;
        const result = await pool.query(`
            SELECT * FROM public.acc_financial_period
            WHERE finyearid = $1
            ORDER BY period_number
        `, [yearId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching periods:', error);
        res.status(500).json({ error: error.message });
    }
});

// Validate date overlap
router.post('/validate', authenticateToken, checkPermission('Settings_Financial Year_View'), async (req, res) => {
    try {
        const { fromDate, toDate, excludeYearId } = req.body;
        
        let query = `
            SELECT finyearid, finyearname, fydatefrom, fydateto
            FROM public.tblfinyear
            WHERE (
                (fydatefrom <= $1 AND fydateto >= $1) OR
                (fydatefrom <= $2 AND fydateto >= $2) OR
                (fydatefrom >= $1 AND fydateto <= $2)
            )
        `;
        
        const params = [fromDate, toDate];
        
        if (excludeYearId) {
            query += ` AND finyearid != $3`;
            params.push(excludeYearId);
        }
        
        const result = await pool.query(query, params);
        
        if (result.rows.length > 0) {
            res.json({
                valid: false,
                message: 'Date range overlaps with existing financial year',
                overlappingYear: result.rows[0]
            });
        } else {
            res.json({ valid: true });
        }
    } catch (error) {
        console.error('Error validating dates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create financial year with periods
router.post('/', authenticateToken, checkPermission('Settings_Financial Year_Add'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { yearName, fromDate, toDate } = req.body;
        
        await client.query('BEGIN');
        
        // 1. Validate dates
        const validateResult = await client.query(`
            SELECT finyearid, finyearname
            FROM public.tblfinyear
            WHERE (
                (fydatefrom <= $1 AND fydateto >= $1) OR
                (fydatefrom <= $2 AND fydateto >= $2) OR
                (fydatefrom >= $1 AND fydateto <= $2)
            )
        `, [fromDate, toDate]);
        
        if (validateResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Date range overlaps with existing financial year: ' + validateResult.rows[0].finyearname
            });
        }
        
        // 2. Get next finyearid
        const maxIdResult = await client.query('SELECT COALESCE(MAX(finyearid), 0) + 1 as next_id FROM public.tblfinyear');
        const nextYearId = maxIdResult.rows[0].next_id;
        
        // 3. Create financial year
        await client.query(`
            INSERT INTO public.tblfinyear (finyearid, finyearname, fydatefrom, fydateto)
            VALUES ($1, $2, $3, $4)
        `, [nextYearId, yearName, fromDate, toDate]);
        
        // 4. Create 12 monthly periods
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        
        for (let i = 0; i < 12; i++) {
            const periodStart = new Date(startDate);
            periodStart.setMonth(startDate.getMonth() + i);
            
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            periodEnd.setDate(0); // Last day of month
            
            // Don't exceed the financial year end date
            if (periodEnd > endDate) {
                periodEnd.setTime(endDate.getTime());
            }
            
            const monthNames = ['April', 'May', 'June', 'July', 'August', 'September', 
                              'October', 'November', 'December', 'January', 'February', 'March'];
            const periodName = monthNames[i];
            
            // First period is Open, rest are Closed
            const status = i === 0 ? 'Open' : 'Closed';
            
            await client.query(`
                INSERT INTO public.acc_financial_period 
                (finyearid, period_name, period_number, start_date, end_date, status)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [nextYearId, periodName, i + 1, periodStart, periodEnd, status]);
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Financial year created successfully',
            yearId: nextYearId
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating financial year:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Open/Close period
router.patch('/:periodId/status', authenticateToken, checkPermission('Settings_Financial Year_Edit'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { periodId } = req.params;
        const { status, userId } = req.body;
        
        // If closing the period, check for unposted transactions
        if (status === 'Closed') {
            // Get period details
            const periodResult = await client.query(`
                SELECT finyearid, start_date, end_date, period_name
                FROM public.acc_financial_period
                WHERE period_id = $1
            `, [periodId]);
            
            if (periodResult.rows.length === 0) {
                return res.status(404).json({ error: 'Period not found' });
            }
            
            const period = periodResult.rows[0];
            const { finyearid, start_date, end_date } = period;
            
            // Check for confirmed but not posted transactions
            const unpostedChecks = [];
            
            // 1. Check Sales Invoices (trn_invoice_master)
            // Note: This table doesn't have is_confirmed column, only is_posted
            // Check for records that are not deleted and not posted
            const salesCheck = await client.query(`
                SELECT COUNT(*) as count
                FROM trn_invoice_master
                WHERE fyear_id = $1
                AND inv_date BETWEEN $2 AND $3
                AND is_posted = false
                AND (is_deleted = false OR is_deleted IS NULL)
            `, [finyearid, start_date, end_date]);
            
            if (parseInt(salesCheck.rows[0].count) > 0) {
                unpostedChecks.push(`${salesCheck.rows[0].count} Sales Invoice(s)`);
            }
            
            // 2. Check Sales Returns (inv_trn_sales_return_master)
            const salesReturnCheck = await client.query(`
                SELECT COUNT(*) as count
                FROM inv_trn_sales_return_master
                WHERE fyear_id = $1
                AND sales_ret_date BETWEEN $2 AND $3
                AND is_confirmed = true
                AND is_posted = false
                AND is_cancelled = false
            `, [finyearid, start_date, end_date]);
            
            if (parseInt(salesReturnCheck.rows[0].count) > 0) {
                unpostedChecks.push(`${salesReturnCheck.rows[0].count} Sales Return(s)`);
            }
            
            // 3. Check Purchase Invoices (tbltrnpurchase)
            // Note: This table uses grnposted column instead of is_posted
            // Check for records that are not cancelled and not posted
            const purchaseCheck = await client.query(`
                SELECT COUNT(*) as count
                FROM tbltrnpurchase
                WHERE fyearid = $1
                AND trdate BETWEEN $2 AND $3
                AND (grnposted = false OR grnposted IS NULL)
                AND is_cancelled = false
            `, [finyearid, start_date, end_date]);
            
            if (parseInt(purchaseCheck.rows[0].count) > 0) {
                unpostedChecks.push(`${purchaseCheck.rows[0].count} Purchase Invoice(s)`);
            }
            
            // 4. Check Purchase Returns (trn_purchase_return_master)
            const purchaseReturnCheck = await client.query(`
                SELECT COUNT(*) as count
                FROM trn_purchase_return_master
                WHERE fyear_id = $1
                AND tran_date BETWEEN $2 AND $3
                AND is_posted = false
                AND deleted = false
            `, [finyearid, start_date, end_date]);
            
            if (parseInt(purchaseReturnCheck.rows[0].count) > 0) {
                unpostedChecks.push(`${purchaseReturnCheck.rows[0].count} Purchase Return(s)`);
            }
            
            // If there are unposted transactions, return error
            if (unpostedChecks.length > 0) {
                return res.status(400).json({
                    error: 'Cannot close period with unposted transactions',
                    unpostedTransactions: unpostedChecks,
                    message: `The following transactions are confirmed but not yet posted: ${unpostedChecks.join(', ')}. Please post all transactions before closing the period.`
                });
            }
        }
        
        // Update period status
        if (status === 'Open') {
            await client.query(`
                UPDATE public.acc_financial_period
                SET status = $1, opened_by = $2, opened_at = NOW()
                WHERE period_id = $3
            `, [status, userId, periodId]);
        } else {
            await client.query(`
                UPDATE public.acc_financial_period
                SET status = $1, closed_by = $2, closed_at = NOW()
                WHERE period_id = $3
            `, [status, userId, periodId]);
        }
        
        res.json({ success: true, message: `Period ${status.toLowerCase()} successfully` });
    } catch (error) {
        console.error('Error updating period status:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Delete financial year (with all periods)
router.delete('/:yearId', authenticateToken, checkPermission('Settings_Financial Year_Delete'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { yearId } = req.params;
        
        await client.query('BEGIN');
        
        // Delete periods first
        await client.query('DELETE FROM public.acc_financial_period WHERE finyearid = $1', [yearId]);
        
        // Delete financial year
        await client.query('DELETE FROM public.tblfinyear WHERE finyearid = $1', [yearId]);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Financial year deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting financial year:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
