-- Sample data for dashboard testing
-- Run this after your main database.sql to populate tables with test data

-- Insert sample financial year
INSERT INTO tblfinyear (finyearid, finyearname, fydatefrom, fydateto) VALUES 
(1, '2024-25', '2024-04-01', '2025-03-31'),
(2, '2023-24', '2023-04-01', '2024-03-31')
ON CONFLICT (finyearid) DO NOTHING;

-- Insert sample brands
INSERT INTO tblmasbrand (brandid, brandname) VALUES 
(1, 'Apple'),
(2, 'Samsung'),
(3, 'Dell'),
(4, 'HP'),
(5, 'Lenovo'),
(6, 'Sony'),
(7, 'LG'),
(8, 'Microsoft'),
(9, 'Canon'),
(10, 'Epson')
ON CONFLICT (brandid) DO NOTHING;

-- Insert sample groups
INSERT INTO tblmasgroup (groupid, groupname) VALUES 
(1, 'Electronics'),
(2, 'Computers & Laptops'),
(3, 'Mobile Phones'),
(4, 'Accessories'),
(5, 'Software'),
(6, 'Printers & Scanners'),
(7, 'Audio & Video'),
(8, 'Storage Devices'),
(9, 'Networking'),
(10, 'Office Supplies')
ON CONFLICT (groupid) DO NOTHING;

-- Insert sample makes
INSERT INTO tblmasmake (makeid, makename) VALUES 
(1, 'Laptop'),
(2, 'Desktop'),
(3, 'Smartphone'),
(4, 'Tablet'),
(5, 'Accessories'),
(6, 'Printer'),
(7, 'Monitor'),
(8, 'Keyboard'),
(9, 'Mouse'),
(10, 'Headphones')
ON CONFLICT (makeid) DO NOTHING;

-- Insert sample parties (suppliers and customers)
INSERT INTO tblmasparty (partyid, partycode, partytype, partyname, contactno, address1, gstnum) VALUES 
(1, 1001, 1, 'ABC Electronics Ltd', '9876543210', '123 Main Street, Mumbai', '27ABCDE1234F1Z5'),
(2, 1002, 1, 'XYZ Tech Suppliers', '9876543211', '456 Park Avenue, Delhi', '07XYZAB5678G2H6'),
(3, 1003, 1, 'Tech Solutions Inc', '9876543212', '789 Tech Park, Bangalore', '29TECHNO9012I3J7'),
(4, 1004, 1, 'Digital World Pvt Ltd', '9876543213', '321 IT Hub, Pune', '27DIGITA3456K4L8'),
(5, 1005, 1, 'Global Electronics', '9876543214', '654 Electronics Market, Chennai', '33GLOBAL7890M5N9'),
(6, 2001, 2, 'Retail Customer One', '9876543215', '111 Customer Street', '27RETAIL1111O6P0'),
(7, 2002, 2, 'Corporate Client Ltd', '9876543216', '222 Business District', '07CORPOR2222Q7R1'),
(8, 2003, 2, 'Small Business Co', '9876543217', '333 SME Park', '29SMALLB3333S8T2'),
(9, 2004, 2, 'Enterprise Solutions', '9876543218', '444 Enterprise Zone', '27ENTERP4444U9V3'),
(10, 2005, 2, 'Startup Hub', '9876543219', '555 Innovation Center', '33STARTU5555W0X4')
ON CONFLICT (partyid) DO NOTHING;

-- Insert sample items with realistic pricing
INSERT INTO tblmasitem (itemcode, groupid, makeid, brandid, itemname, packing, cost, avgcost, curstock, sprice, mrp, unit, cgst, sgst, igst, hsncode, partyid) VALUES 
(1001, 2, 1, 1, 'MacBook Pro 16" M3 Chip', 'Box', 180000.00, 180000.00, 25, 200000.00, 220000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 1),
(1002, 3, 3, 1, 'iPhone 15 Pro 256GB', 'Box', 120000.00, 120000.00, 50, 135000.00, 150000.00, 'PCS', 9.00, 9.00, 18.00, '8517', 1),
(1003, 2, 1, 2, 'Samsung Galaxy Book Pro', 'Box', 85000.00, 85000.00, 15, 95000.00, 105000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 2),
(1004, 3, 3, 2, 'Samsung Galaxy S24 Ultra', 'Box', 85000.00, 85000.00, 35, 95000.00, 105000.00, 'PCS', 9.00, 9.00, 18.00, '8517', 2),
(1005, 4, 5, 3, 'Dell Wireless Mouse WM126', 'Box', 1500.00, 1500.00, 5, 2000.00, 2500.00, 'PCS', 9.00, 9.00, 18.00, '8471', 3),
(1006, 4, 5, 4, 'HP USB-C Cable 2m', 'Pack', 800.00, 800.00, 8, 1200.00, 1500.00, 'PCS', 9.00, 9.00, 18.00, '8544', 3),
(1007, 2, 1, 5, 'Lenovo ThinkPad E15', 'Box', 65000.00, 65000.00, 20, 75000.00, 85000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 3),
(1008, 6, 6, 4, 'HP LaserJet Pro M404n', 'Box', 15000.00, 15000.00, 12, 18000.00, 20000.00, 'PCS', 9.00, 9.00, 18.00, '8443', 4),
(1009, 7, 7, 3, 'Dell 24" LED Monitor', 'Box', 12000.00, 12000.00, 18, 15000.00, 17000.00, 'PCS', 9.00, 9.00, 18.00, '8528', 3),
(1010, 4, 10, 6, 'Sony WH-1000XM5 Headphones', 'Box', 25000.00, 25000.00, 8, 30000.00, 35000.00, 'PCS', 9.00, 9.00, 18.00, '8518', 5),
(1011, 8, 8, 5, 'Logitech MX Keys Keyboard', 'Box', 8000.00, 8000.00, 15, 10000.00, 12000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 4),
(1012, 4, 4, 1, 'iPad Air 5th Gen 256GB', 'Box', 55000.00, 55000.00, 22, 65000.00, 75000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 1),
(1013, 9, 5, 3, 'Dell PowerConnect Switch', 'Box', 35000.00, 35000.00, 6, 42000.00, 48000.00, 'PCS', 9.00, 9.00, 18.00, '8517', 3),
(1014, 8, 5, 2, 'Samsung T7 SSD 1TB', 'Box', 8500.00, 8500.00, 25, 10500.00, 12000.00, 'PCS', 9.00, 9.00, 18.00, '8471', 2),
(1015, 6, 6, 9, 'Canon PIXMA G3010', 'Box', 12500.00, 12500.00, 10, 15000.00, 17500.00, 'PCS', 9.00, 9.00, 18.00, '8443', 5)
ON CONFLICT (itemcode) DO NOTHING;

-- Insert sample purchase transactions (recent and historical)
INSERT INTO tbltrnpurchase (fyearid, tranid, trno, trdate, suppinvno, suppinvdt, partyid, remark, invamt, cgst, sgst, igst, is_cancelled) VALUES 
(1, 1001, 1, '2024-12-15', 'ABC001', '2024-12-15', 1, 'Apple products purchase', 450000.00, 40500.00, 40500.00, 0.00, false),
(1, 1002, 2, '2024-12-14', 'XYZ002', '2024-12-14', 2, 'Samsung devices bulk order', 340000.00, 30600.00, 30600.00, 0.00, false),
(1, 1003, 3, '2024-12-13', 'TECH003', '2024-12-13', 3, 'Dell accessories and monitors', 125000.00, 11250.00, 11250.00, 0.00, false),
(1, 1004, 4, '2024-12-12', 'DIG004', '2024-12-12', 4, 'HP printers and keyboards', 85000.00, 7650.00, 7650.00, 0.00, false),
(1, 1005, 5, '2024-12-11', 'GLB005', '2024-12-11', 5, 'Sony headphones and Canon printers', 95000.00, 8550.00, 8550.00, 0.00, false),
(1, 1006, 6, '2024-11-28', 'ABC006', '2024-11-28', 1, 'Previous month - Apple products', 280000.00, 25200.00, 25200.00, 0.00, false),
(1, 1007, 7, '2024-11-25', 'XYZ007', '2024-11-25', 2, 'Previous month - Samsung order', 220000.00, 19800.00, 19800.00, 0.00, false),
(1, 1008, 8, '2024-11-20', 'TECH008', '2024-11-20', 3, 'Previous month - Dell equipment', 180000.00, 16200.00, 16200.00, 0.00, false),
(1, 1009, 9, '2024-10-15', 'DIG009', '2024-10-15', 4, 'October purchase - HP products', 150000.00, 13500.00, 13500.00, 0.00, false),
(1, 1010, 10, '2024-10-10', 'GLB010', '2024-10-10', 5, 'October purchase - Audio equipment', 120000.00, 10800.00, 10800.00, 0.00, false)
ON CONFLICT (tranid) DO NOTHING;

-- Insert sample sales/invoice transactions
INSERT INTO trn_invoice_master (fyear_id, inv_master_id, inv_no, inv_date, ref_no, party_id, customer_name, taxable_tot, cgst_amount, sgst_amount, igst_amount, tot_amount, description, is_posted, is_deleted) VALUES 
(1, 2001, 1001, '2024-12-16', 'INV001', 6, 'Retail Customer One', 45000.00, 4050.00, 4050.00, 0.00, 53100.00, 'MacBook Pro sale', true, false),
(1, 2002, 1002, '2024-12-15', 'INV002', 7, 'Corporate Client Ltd', 85000.00, 7650.00, 7650.00, 0.00, 100300.00, 'Bulk laptop order', true, false),
(1, 2003, 1003, '2024-12-14', 'INV003', 8, 'Small Business Co', 25000.00, 2250.00, 2250.00, 0.00, 29500.00, 'Office accessories', true, false),
(1, 2004, 1004, '2024-12-13', 'INV004', 9, 'Enterprise Solutions', 120000.00, 10800.00, 10800.00, 0.00, 141600.00, 'IT equipment setup', true, false),
(1, 2005, 1005, '2024-12-12', 'INV005', 10, 'Startup Hub', 35000.00, 3150.00, 3150.00, 0.00, 41300.00, 'Startup package', true, false),
(1, 2006, 1006, '2024-11-30', 'INV006', 6, 'Retail Customer One', 65000.00, 5850.00, 5850.00, 0.00, 76700.00, 'Previous month sale', true, false),
(1, 2007, 1007, '2024-11-25', 'INV007', 7, 'Corporate Client Ltd', 95000.00, 8550.00, 8550.00, 0.00, 112100.00, 'Previous month corporate', true, false)
ON CONFLICT (inv_master_id) DO NOTHING;

-- Insert sample stock ledger entries
INSERT INTO trn_stock_ledger (fyear_id, stock_ledger_id, inv_master_id, itemcode, tran_type, tran_date, unit, qty) VALUES 
(1, 1, 1001, 1001, 'IN', '2024-12-15', 'PCS', 10),
(1, 2, 1001, 1002, 'IN', '2024-12-15', 'PCS', 20),
(1, 3, 1002, 1003, 'IN', '2024-12-14', 'PCS', 15),
(1, 4, 1002, 1004, 'IN', '2024-12-14', 'PCS', 25),
(1, 5, 1003, 1005, 'IN', '2024-12-13', 'PCS', 50),
(1, 6, 1003, 1009, 'IN', '2024-12-13', 'PCS', 20),
(1, 7, 1004, 1008, 'IN', '2024-12-12', 'PCS', 15),
(1, 8, 1005, 1010, 'IN', '2024-12-11', 'PCS', 12),
(1, 9, 2001, 1001, 'OUT', '2024-12-16', 'PCS', 2),
(1, 10, 2002, 1003, 'OUT', '2024-12-15', 'PCS', 5),
(1, 11, 2003, 1005, 'OUT', '2024-12-14', 'PCS', 10),
(1, 12, 2004, 1007, 'OUT', '2024-12-13', 'PCS', 8),
(1, 13, 2005, 1009, 'OUT', '2024-12-12', 'PCS', 3)
ON CONFLICT (stock_ledger_id) DO NOTHING;

-- Insert sample company data
INSERT INTO tbl_company (company_id, company_name, address_line1, address_line2, city, state, pincode, gst_number, pan_number, contact_person, phone_number1, email) VALUES 
(1, 'TechMart Solutions Pvt Ltd', 'Plot No. 123, Tech Park', 'Sector 15, IT Hub', 'Mumbai', 'Maharashtra', '400001', '27TECHMART123F1Z5', 'TECHMART123', 'Rajesh Kumar', '+91-9876543210', 'info@techmart.com')
ON CONFLICT (company_id) DO NOTHING;

-- Update some items to have low stock for alerts
UPDATE tblmasitem SET curstock = 3 WHERE itemcode = 1005;  -- Dell Mouse - Low stock
UPDATE tblmasitem SET curstock = 5 WHERE itemcode = 1006;  -- HP Cable - Low stock  
UPDATE tblmasitem SET curstock = 2 WHERE itemcode = 1013;  -- Dell Switch - Very low stock
UPDATE tblmasitem SET curstock = 7 WHERE itemcode = 1010;  -- Sony Headphones - Low stock
UPDATE tblmasitem SET curstock = 4 WHERE itemcode = 1015;  -- Canon Printer - Low stock