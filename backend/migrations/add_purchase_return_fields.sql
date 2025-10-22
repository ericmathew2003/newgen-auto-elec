-- Migration: Add ref_no, supplier_inv_no, and description columns to trn_purchase_return_master
-- Date: 2024

-- Add ref_no column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trn_purchase_return_master' 
        AND column_name = 'ref_no'
    ) THEN
        ALTER TABLE trn_purchase_return_master 
        ADD COLUMN ref_no VARCHAR(50);
    END IF;
END $$;

-- Add supplier_inv_no column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trn_purchase_return_master' 
        AND column_name = 'supplier_inv_no'
    ) THEN
        ALTER TABLE trn_purchase_return_master 
        ADD COLUMN supplier_inv_no VARCHAR(50);
    END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trn_purchase_return_master' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE trn_purchase_return_master 
        ADD COLUMN description VARCHAR(150);
    END IF;
END $$;