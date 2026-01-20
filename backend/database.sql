-- Account Type Master
CREATE TABLE public.acc_mas_acc_type (
    acc_type_id smallint NOT NULL,
    acc_type_name character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Account Master
CREATE TABLE public.acc_mas_account (
    account_id bigint NOT NULL,
    account_code character varying(20),
    account_name character varying(75),
    account_type_id smallint,
    acc_parent_acc_id smallint,
    account_level smallint,
    is_active boolean,
    tag character varying(255),
    created_date timestamp without time zone,
    edited_date timestamp without time zone
);

-- Account Ledger
CREATE TABLE public.acc_ledger (
    fyear_id smallint,
    tran_id bigint NOT NULL,
    master_id bigint,
    detail_id bigint,
    serial_no character varying(6),
    tran_date date,
    account_id bigint NOT NULL,
    party_id bigint,
    tran_amount numeric(12,2),
    tran_type character varying(10),
    description character varying(100),
    doc_type character varying(5),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Account Invoice Transaction
CREATE TABLE public.acc_trn_invoice (
    fyear_id smallint,
    tran_id bigint NOT NULL,
    party_id bigint NOT NULL,
    tran_type character varying(10),
    inv_master_id bigint,
    tran_date date,
    party_inv_no character varying(10),
    party_inv_date date,
    tran_amount numeric(12,2),
    paid_amount numeric(12,2),
    status smallint,
    inv_reference character varying(30),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Account Journal
CREATE TABLE public.acc_trn_journal (
    fyear_id smallint,
    journal_mas_id bigint DEFAULT nextval('public.acc_trn_journal_mas_id_seq'::regclass) NOT NULL,
    serial_no character varying(6),
    journal_date date,
    journal_type character varying(10),
    tran_master_id bigint,
    reference character varying(40),
    description character varying(50),
    total numeric(12,2),
    is_deleted boolean,
    created_date timestamp without time zone,
    edited_date timestamp without time zone
);

-- Account Journal Details
CREATE TABLE public.acc_trn_journal_det (
    fyear_id smallint,
    journal_det_id bigint NOT NULL,
    journal_mas_id bigint NOT NULL,
    serial_no character varying(6),
    account_id bigint NOT NULL,
    party_id bigint,
    dr_amount numeric(12,2),
    cr_amount numeric(12,2),
    description character varying(150),
    is_deleted boolean,
    created_date timestamp without time zone,
    edited_date timestamp without time zone
);

-- Account Matching
CREATE TABLE public.acc_trn_matching (
    match_id bigint NOT NULL,
    party_id bigint,
    payment_id bigint,
    inv_master_id bigint,
    matched_amount numeric(12,2),
    description character varying(30),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Account Payment
CREATE TABLE public.acc_trn_payment (
    fyear_id smallint,
    payment_id bigint NOT NULL,
    tran_type character varying(20),
    serial_no character varying(6),
    party_id bigint,
    doc_type character varying(10),
    trn_date date,
    amount numeric(12,2),
    matched_amount numeric(12,2),
    status smallint,
    pay_account_id bigint,
    chq_no character varying(8),
    chq_date date,
    posted boolean,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Login
CREATE TABLE public.login (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL
);

-- Company
CREATE TABLE public.tbl_company (
    company_id integer NOT NULL,
    company_name character varying(200) NOT NULL,
    address_line1 character varying(200),
    address_line2 character varying(200),
    city character varying(100),
    state character varying(100),
    pincode character varying(15),
    country character varying(100) DEFAULT 'India'::character varying,
    gst_number character varying(25),
    pan_number character varying(20),
    contact_person character varying(100),
    phone_number1 character varying(20),
    phone_number2 character varying(20),
    email character varying(150),
    website character varying(150),
    created_date timestamp without time zone DEFAULT now(),
    edited_date timestamp without time zone DEFAULT now()
);

-- Financial Year
CREATE TABLE public.tblfinyear (
    finyearid bigint NOT NULL,
    finyearname character varying(50),
    fydatefrom timestamp without time zone,
    fydateto timestamp without time zone
);

-- Brand Master
CREATE TABLE public.tblmasbrand (
    brandid bigint NOT NULL,
    brandname character varying(100),
    created_date timestamp without time zone DEFAULT now(),
    edited_date timestamp without time zone DEFAULT now()
);

-- Group Master
CREATE TABLE public.tblmasgroup (
    groupid bigint NOT NULL,
    groupname character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Item Master
CREATE TABLE public.tblmasitem (
    itemcode bigint NOT NULL,
    groupid bigint,
    makeid bigint,
    brandid bigint,
    itemname character varying(200),
    packing character varying(20),
    suppref character varying(10),
    barcode character varying(15),
    cost numeric(12,2),
    avgcost numeric(12,2),
    curstock numeric(12,2),
    sprice numeric(12,2),
    mrp numeric(12,2),
    unit character varying(6),
    shelf character varying(10),
    partno character varying(20),
    model character varying(100),
    cgst numeric(5,2),
    sgst numeric(5,2),
    igst numeric(5,2),
    hsncode character varying(10),
    partyid bigint,
    isexpence boolean,
    deleted boolean,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    billable boolean
);

-- Make Master
CREATE TABLE public.tblmasmake (
    makeid bigint NOT NULL,
    makename character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Party Master
CREATE TABLE public.tblmasparty (
    partyid bigint NOT NULL,
    partycode bigint,
    partytype smallint,
    partyname character varying(100),
    contactno character varying(20),
    address1 character varying(50),
    accountid smallint,
    gstnum character varying(30),
    address2 character varying(50),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Purchase Transaction
CREATE TABLE public.tbltrnpurchase (
    fyearid smallint,
    tranid bigint NOT NULL,
    trno bigint,
    trdate date,
    suppinvno character varying(20),
    suppinvdt date,
    partyid bigint,
    remark character varying(50),
    invamt real,
    tptcharge real,
    labcharge real,
    misccharge real,
    packcharge real,
    rounded real,
    cgst real,
    sgst real,
    igst real,
    costsheetprepared boolean,
    grnposted boolean,
    costconfirmed boolean,
    created_date timestamp without time zone DEFAULT now(),
    edited_date timestamp without time zone DEFAULT now(),
    is_cancelled boolean DEFAULT false NOT NULL
);

-- Purchase Costing
CREATE TABLE public.tbltrnpurchasecosting (
    costtrid bigint NOT NULL,
    pruchmasid bigint NOT NULL,
    ohtype character varying(100) NOT NULL,
    amount numeric(12,2) NOT NULL,
    referenceno character varying(50),
    ohdate date,
    remark character varying(200)
);

-- Purchase Details
CREATE TABLE public.tbltrnpurchasedet (
    fyearid smallint NOT NULL,
    trid bigint NOT NULL,
    tranmasid bigint NOT NULL,
    srno bigint,
    itemcode bigint NOT NULL,
    qty numeric(12,2),
    rate numeric(12,2),
    invamount numeric(12,2),
    ohamt numeric(12,2),
    netrate numeric(12,2),
    rounded numeric(4,2),
    cgst numeric(12,2),
    sgst numeric(12,2),
    igst numeric(12,2),
    gtotal numeric(12,2),
    cgstp numeric(5,2),
    sgstp numeric(5,2),
    igstp numeric(5,2)
);

-- Invoice Details
CREATE TABLE public.trn_invoice_detail (
    fyear_id smallint,
    inv_detail_id bigint NOT NULL,
    inv_master_id bigint NOT NULL,
    srno integer,
    itemcode bigint,
    unit character varying(6),
    qty numeric(12,2),
    avg_cost numeric(12,2),
    taxable_rate numeric(12,2),
    cgst_per numeric(5,2),
    sgst_per numeric(5,2),
    igst_per numeric(5,2),
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    rate numeric(12,2),
    dis_per numeric(5,2),
    dis_amount numeric(12,2),
    tot_amount numeric(12,2),
    description character varying(50),
    is_deleted boolean,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Invoice Master
CREATE TABLE public.trn_invoice_master (
    fyear_id smallint,
    inv_master_id bigint NOT NULL,
    inv_no bigint,
    inv_date date,
    ref_no character varying(15),
    party_id bigint,
    customer_name character varying(100),
    account_id bigint,
    taxable_tot numeric(12,2),
    dis_perc numeric(5,2),
    dis_amount numeric(12,2),
    misc_per_add numeric(5,2),
    misc_amount_add numeric(12,2),
    tot_avg_cost numeric(12,2),
    tot_amount numeric(12,2),
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    description character varying(150),
    is_posted boolean,
    is_deleted boolean,
    rounded_off numeric(5,3) DEFAULT 0,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Stock Ledger
CREATE TABLE public.trn_stock_ledger (
    fyear_id smallint,
    stock_ledger_id bigint NOT NULL,
    inv_master_id bigint,
    inv_detail_id bigint,
    itemcode bigint,
    tran_type character varying(5),
    tran_date date,
    unit character varying(6),
    qty numeric(12,2)
);

-- Purchase Return Master
CREATE TABLE public.trn_purchase_return_master (
    pret_id bigint NOT NULL,
    fyear_id smallint,
    purch_ret_no character varying(20),
    tran_date date,
    party_id bigint,
    remark character varying(200),
    taxable_total numeric(12,2),
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    rounded_off numeric(12,2),
    total_amount numeric(12,2),
    is_posted boolean DEFAULT false,
    deleted boolean DEFAULT false,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Purchase Return Detail
CREATE TABLE public.trn_purchase_return_detail (
    pret_det_id bigint NOT NULL,
    fyear_id smallint,
    pret_mas_id bigint NOT NULL,
    srno integer,
    item_code bigint,
    qty numeric(12,3) DEFAULT 0,
    taxable_rate numeric(12,2) DEFAULT 0,
    taxable_amount numeric(12,2) DEFAULT 0,
    cgst_per numeric(5,2) DEFAULT 0,
    sgst_per numeric(5,2) DEFAULT 0,
    igst_per numeric(5,2) DEFAULT 0,
    cgst_amount numeric(12,2) DEFAULT 0,
    sgst_amount numeric(12,2) DEFAULT 0,
    igst_amount numeric(12,2) DEFAULT 0,
    oh_amt numeric(12,2) DEFAULT 0,
    netrate numeric(12,2) DEFAULT 0,
    rounded_off numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    supp_inv_no character varying(50),
    supp_inv_date date,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.acc_mas_group (
    group_id SMALLSERIAL PRIMARY KEY, 
    group_name CITEXT NOT NULL UNIQUE, 
    
    -- Statement Category: 'BS' (Balance Sheet) or 'PL' (Profit & Loss)
    group_type VARCHAR(10) NOT NULL, 
    
    -- Hierarchy: Self-referencing Foreign Key to allow nested grouping (e.g., Current Assets under Assets)
    parent_group_id SMALLINT,
    
    -- The natural balance of the group: 'DEBIT' or 'CREDIT'
    normal_balance VARCHAR(6) NOT NULL, 
    
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    
    -- Constraint to enforce the hierarchy linkage
    CONSTRAINT fk_parent_group
        FOREIGN KEY (parent_group_id) 
        REFERENCES public.acc_mas_group (group_id)
);

ALTER TABLE public.acc_mas_group OWNER TO postgres;

--2

CREATE TABLE public.acc_mas_coa (
    account_id BIGSERIAL PRIMARY KEY,
    
    -- Code: User-defined code for sorting and searching
    account_code VARCHAR(20) NOT NULL UNIQUE,
    account_name CITEXT NOT NULL UNIQUE,
    
    -- Foreign Key to link to the Account Group
    group_id SMALLINT NOT NULL,
    
    -- Balance: Stored for quick reference/validation
    normal_balance VARCHAR(6) NOT NULL,

	-- Tag: CITEXT for case-insensitive, for grouping accounts like cash for all type of petty cash and cash account, Bank for all bank accounts
    account_tag CITEXT ,
    
    -- Control Flag: TRUE if journal entries can be posted directly to this account
    is_posting_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Control Flag: TRUE for accounts requiring external reconciliation (e.g., Bank, AR, AP)
    is_reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE,

	-- Control Flag: TRUE for active accounts
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,

    -- Foreign Key Constraint linking to the Account Group table
    CONSTRAINT fk_group_id
        FOREIGN KEY (group_id)
        REFERENCES public.acc_mas_group (group_id)
);

ALTER TABLE public.acc_mas_coa OWNER TO postgres;

-- 3. Journal Master Table (Voucher Header)

CREATE TABLE acc_journal_master (
    journal_mas_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_date DATE NOT NULL,
    finyearid SMALLINT NOT NULL,
    journal_serial TEXT NOT NULL UNIQUE,
    -- Source Document Reference
    source_document_type VARCHAR(30) NOT NULL, -- e.g., 'SALES_INVOICE', 'PAYMENT_RECEIPT'
    source_document_ref VARCHAR(50) NOT NULL, -- e.g., Invoice No., Receipt No.
    source_document_id INT -- e.g., primary ID for source table
    total_debit NUMERIC(18, 2) NOT NULL,
    total_credit NUMERIC(18, 2) NOT NULL,
    narration TEXT,
    posted_by_user_id INT, -- Foreign key to a users table (assuming INT ID)
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,

    CONSTRAINT fk_acc_journal_master_fyear
    FOREIGN KEY (fyear_id)
    REFERENCES public.tblfinyear(fyear_id) ON DELETE RESTRICT
);

-- 4. Journal Detail Table (Ledger Lines)
CREATE TABLE acc_journal_detail (
    journal_detail_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_mas_id BIGINT NOT NULL,
    account_id INT NOT NULL,
    party_id bigint,
    debit_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    credit_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    -- Link to Sub-ledger Allocation (Optional FK to invoice_payments_allocation)
    allocation_ref_id BIGINT,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    -- Foreign Key Definitions (Assuming other tables exist)
    -- FK to acc_journal_master
    CONSTRAINT fk_acc_journal_detail_master
        FOREIGN KEY (journal_mas_id)
        REFERENCES acc_journal_master(journal_mas_id) ,

    -- FK to coa_master (Assuming account_id is INT)
    -- CONSTRAINT fk_acc_journal_detail_coa
    --     FOREIGN KEY (account_id)
    --     REFERENCES coa_master(account_id) ON DELETE RESTRICT,

    -- FK to invoice_payments_allocation (Assuming allocation_ref_id is BIGINT)
    -- CONSTRAINT fk_acc_journal_detail_allocation
    --     FOREIGN KEY (allocation_ref_id)
    --     REFERENCES invoice_payments_allocation(allocation_id) ON DELETE RESTRICT,
);

-- Indexing for performance on common lookups
CREATE INDEX idx_jd_journal_mas_id ON acc_journal_detail (journal_mas_id);
CREATE INDEX idx_jd_account_id ON acc_journal_detail (account_id);


CREATE TABLE transaction_mapping (
    
    mapping_id SMALLSERIAL PRIMARY KEY,

    -- Key for identifying the business event
    transaction_type VARCHAR(30) NOT NULL, -- e.g., 'SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN'

    -- Order of posting for readability and logical processing
    entry_sequence INT NOT NULL,

    -- The ACCOUNTS KEY: Defines the nature of the account involved
    account_nature VARCHAR(50) NOT NULL, -- e.g., 'CUSTOMER', 'REVENUE', 'INPUT_CGST', 'COGS'

    -- Debit or Credit flag
    debit_credit CHAR(1) NOT NULL,
    CONSTRAINT chk_debit_credit CHECK (debit_credit IN ('D', 'C')),

    -- Source of the monetary value from the invoice document
    value_source VARCHAR(50) NOT NULL, -- e.g., 'INVOICE_TOTAL', 'GROSS_TOTAL', 'ITEM_COST_TOTAL'

    -- Template for generating the ledger description (narration)
    description_template TEXT,

    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
);

-- Indexing for fast lookups based on the transaction type (crucial for posting)
CREATE INDEX idx_tm_transaction_type ON transaction_mapping (transaction_type);

CREATE TABLE acc_receipts (
    
    -- Primary Key
    receipt_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fyear_id SMALLINT NOT NULL,

    -- Transaction Details
    receipt_date DATE NOT NULL,
    receipt_amount DECIMAL(18, 2) NOT NULL,
    reference_number VARCHAR(50), -- e.g., Cheque No., UPI Ref ID

    -- Party and Account Linkage
    party_id INT NOT NULL, -- FK to tblmasparty (Customer/Generic Cash Party)
    payment_account_id INT NOT NULL, -- FK to coa_master (Actual Cash/Bank GL Account being Debited)

    -- Status Tracking
    unallocated_amount DECIMAL(18, 2) NOT NULL, -- Amount remaining to be applied to invoices
    is_posted BOOLEAN NOT NULL DEFAULT FALSE, -- Has the journal entry been created?

    -- General Ledger Link
    journal_master_id BIGINT, -- FK to journal_master (The resulting GL voucher)

    -- Audit Timestamps
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL

    -- Foreign Key Placeholders:
    -- CONSTRAINT fk_pr_party FOREIGN KEY (party_id) REFERENCES tblmasparty(party_id) ON DELETE RESTRICT,
    -- CONSTRAINT fk_pr_bank_coa FOREIGN KEY (payment_account_id) REFERENCES coa_master(account_id) ON DELETE RESTRICT,
    -- CONSTRAINT fk_pr_journal FOREIGN KEY (journal_master_id) REFERENCES journal_master(journal_master_id) ON DELETE RESTRICT
);


CREATE TABLE acc_receipt_allocation (
    
    -- Primary Key
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Linkage
    receipt_id BIGINT NOT NULL, -- FK to payment_receipts
    invoice_id BIGINT NOT NULL, -- FK to sales_invoice_header (The invoice being paid)

    -- Allocation Details
    allocated_amount DECIMAL(18, 2) NOT NULL,
    allocation_date DATE NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL, -- e.g., 'AUTO_APPLIED', 'MANUAL_ADJUSTMENT', 'REVERSAL'

    -- Audit Timestamps
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,

    -- Foreign Key Placeholders:
    CONSTRAINT fk_ipa_receipt FOREIGN KEY (receipt_id) REFERENCES payment_receipts(receipt_id) ON DELETE CASCADE
    -- CONSTRAINT fk_ipa_invoice FOREIGN KEY (invoice_id) REFERENCES trn_invoice_master(inv_master_id) ON DELETE RESTRICT
);

-- Indexing
CREATE INDEX idx_pr_party_id ON payment_receipts (party_id);
CREATE INDEX idx_ipa_receipt_id ON invoice_payments_allocation (receipt_id);
CREATE INDEX idx_ipa_invoice_id ON invoice_payments_allocation (invoice_id);


ALTER TABLE public.login ALTER COLUMN role TYPE VARCHAR(50);
UPDATE public.login SET role = 'SALES_STAFF' WHERE role = 'SALESPERSON';




CREATE TABLE con_transaction_mapping(
    
    mapping_id SMALLSERIAL PRIMARY KEY,

    -- Key for identifying the business event
    transaction_type VARCHAR(30) NOT NULL, -- e.g., 'SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN'

    -- Order of posting for readability and logical processing
    entry_sequence INT NOT NULL,

    -- The ACCOUNTS KEY: Defines the nature of the account involved
    account_nature VARCHAR(50) NOT NULL, -- e.g., 'CUSTOMER', 'REVENUE', 'INPUT_CGST', 'COGS'

    -- Debit or Credit flag
    debit_credit CHAR(1) NOT NULL,
    CONSTRAINT chk_debit_credit CHECK (debit_credit IN ('D', 'C')),

    -- Source of the monetary value from the invoice document
    value_source VARCHAR(50) NOT NULL, -- e.g., 'INVOICE_TOTAL', 'GROSS_TOTAL', 'ITEM_COST_TOTAL'

    -- Template for generating the ledger description (narration)
    description_template TEXT,

    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
);

-- Indexing for fast lookups based on the transaction type (crucial for posting)
CREATE INDEX idx_nat_transaction_type ON con_transaction_mapping(transaction_type);


CREATE TABLE acc_mas_nature (
	nature_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

	-- nature_code is the key used in your application logic (e.g., 'AR_CONTROL')
	nature_code VARCHAR(30) NOT NULL,

	-- display_name is what the user sees in dropdowns
	display_name VARCHAR(100) NOT NULL,

	-- module_tag helps filter natures by business process (e.g., SALES, PURCHASE)
	module_tag VARCHAR(20),

	-- dr_cr_side enforces whether this nature typically has a Debit (D) or Credit (C) balance
	dr_cr_side CHAR(1) NOT NULL,

	-- tracks if the record is active
	is_active BOOLEAN NOT NULL DEFAULT TRUE,

	-- Standard audit columns
	created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
	edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
	-- Constraints
	CONSTRAINT uk_nature_code UNIQUE (nature_code),
	CONSTRAINT chk_dr_cr CHECK (dr_cr_side IN ('D', 'C'))
	);


	CREATE TABLE con_acc_value_source (
    value_code CITEXT NOT NULL PRIMARY KEY,   -- e.g. PURCHASE_TAXABLE_AMOUNT
    display_name VARCHAR(100) NOT NULL,   -- "Purchase value before tax"
    module_tag CITEXT ,       -- PURCHASE / SALES
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);
-- value source data insert

INSERT INTO con_acc_value_source
(value_code, display_name, module_tag, description)
VALUES
('PURCHASE_TAXABLE_AMOUNT', 'Purchase value before tax', 'PURCHASE',
 'Sum of item amounts excluding GST'),

('PURCHASE_CGST_AMOUNT', 'Input CGST amount', 'PURCHASE',
 'CGST on purchase invoice'),

('PURCHASE_SGST_AMOUNT', 'Input SGST amount', 'PURCHASE',
 'SGST on purchase invoice'),

('PURCHASE_IGST_AMOUNT', 'Input IGST amount', 'PURCHASE',
 'IGST on purchase invoice'),

('PURCHASE_NET_PAYABLE', 'Net payable to supplier', 'PURCHASE',
 'Total invoice amount including tax and charges');


 CREATE TABLE sec_roles (
    role_id SMALLSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    role_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
);



CREATE TABLE sec_permissions (
    permission_id SMALLSERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL,
    form_name VARCHAR(100) NOT NULL,
    action_name VARCHAR(30) NOT NULL,

    permission_code VARCHAR(200) GENERATED ALWAYS AS (
        module_name || '_' || form_name || '_' || action_name
    ) STORED,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,

    CONSTRAINT uq_permission UNIQUE (module_name, form_name, action_name)
);

🧩 4) Role ↔ Permission mapping

CREATE TABLE sec_role_permissions (
    role_id SMALLINT NOT NULL REFERENCES sec_roles(role_id) ON DELETE CASCADE,
    permission_id SMALLINT NOT NULL REFERENCES sec_permissions(permission_id) ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);

🧩 5) User ↔ Role mapping

--(User inherits permissions from role)

CREATE TABLE sec_user_roles (
    user_id BIGINT NOT NULL REFERENCES sec_users(user_id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES sec_roles(role_id) ON DELETE CASCADE,

    PRIMARY KEY (user_id, role_id)
);




CREATE TABLE sec_users (
    user_id SMALLSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    user_password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT now(),
    edited_dateTIMESTAMP DEFAULT now()
);