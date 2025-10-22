SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'trn_purchase_return_master' 
ORDER BY ordinal_position;