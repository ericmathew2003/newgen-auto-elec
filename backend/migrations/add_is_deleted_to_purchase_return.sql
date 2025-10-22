-- Migration: Add is_deleted column to trn_purchase_return_master table
-- This column is used to soft-delete purchase returns

DO $$ 
BEGIN
    -- Check if is_deleted column exists in trn_purchase_return_master
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trn_purchase_return_master' 
        AND column_name = 'is_deleted'
    ) THEN
        -- Add is_deleted column with default value FALSE
        ALTER TABLE trn_purchase_return_master 
        ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added is_deleted column to trn_purchase_return_master';
    ELSE
        RAISE NOTICE 'Column is_deleted already exists in trn_purchase_return_master';
    END IF;
END $$;