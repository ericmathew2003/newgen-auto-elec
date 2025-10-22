-- Migration: Add is_cancelled column to tblTrnPurchase
-- Date: 2024
-- Description: Adds is_cancelled flag to track cancelled purchases

-- Add is_cancelled column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tbltrnpurchase' 
        AND column_name = 'is_cancelled'
    ) THEN
        ALTER TABLE tblTrnPurchase 
        ADD COLUMN is_cancelled BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column is_cancelled added to tblTrnPurchase';
    ELSE
        RAISE NOTICE 'Column is_cancelled already exists in tblTrnPurchase';
    END IF;
END $$;