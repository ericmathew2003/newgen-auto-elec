-- Migration: Add supplier invoice fields to purchase return detail table
-- This allows each line item to reference its original supplier invoice

ALTER TABLE trn_purchase_return_detail
ADD COLUMN IF NOT EXISTS supp_inv_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS supp_inv_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN trn_purchase_return_detail.supp_inv_no IS 'Supplier invoice number from original purchase';
COMMENT ON COLUMN trn_purchase_return_detail.supp_inv_date IS 'Supplier invoice date from original purchase';