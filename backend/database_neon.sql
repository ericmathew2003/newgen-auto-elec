-- New Gen Auto Database Schema for Neon
-- Fixed version with proper sequences

-- Create sequences first
CREATE SEQUENCE IF NOT EXISTS public.acc_trn_journal_mas_id_seq;

-- Account Type Master
CREATE TABLE IF NOT EXISTS public.acc_mas_acc_type (
    acc_type_id smallint NOT NULL,
    acc_type_name character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (acc_type_id)
);

-- Account Master
CREATE TABLE IF NOT EXISTS public.acc_mas_account (
    account_id bigint NOT NULL,
    account_code character varying(20),
    account_name character varying(75),
    account_type_id smallint,
    acc_parent_acc_id smallint,
    account_level smallint,
    is_active boolean,
    tag character varying(255),
    created_date timestamp without time zone,
    edited_date timestamp without time zone,
    PRIMARY KEY (account_id)
);

-- Account Ledger
CREATE TABLE IF NOT EXISTS public.acc_ledger (
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
CREATE TABLE IF NOT EXISTS public.acc_trn_invoice (
    fyear_id smallint,
    tran_id bigint NOT NULL,
    party_id bigint NOT NULL,
    tran_type character varying(10),
    inv_master_id bigint,
    tran_date date,
    party_inv_no character varying(10),
    party_inv_date date,
    taxable_amount numeric(12,2),
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    total_amount numeric(12,2),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Account Transaction Journal (with proper sequence)
CREATE TABLE IF NOT EXISTS public.acc_trn_journal (
    fyear_id smallint,
    journal_mas_id bigint DEFAULT nextval('public.acc_trn_journal_mas_id_seq'::regclass) NOT NULL,
    serial_no character varying(6),
    journal_date date,
    tran_master_id bigint,
    account_id bigint,
    party_id bigint,
    debit_amount numeric(12,2),
    credit_amount numeric(12,2),
    description character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (journal_mas_id)
);

-- Continue with rest of your tables...
-- (I'll add the key tables you need)

-- Brand Master
CREATE TABLE IF NOT EXISTS public.tblmasbrand (
    brandid bigint NOT NULL,
    brandname character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (brandid)
);

-- Group Master
CREATE TABLE IF NOT EXISTS public.tblmasgroup (
    groupid bigint NOT NULL,
    groupname character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (groupid)
);

-- Make Master
CREATE TABLE IF NOT EXISTS public.tblmasmake (
    makeid bigint NOT NULL,
    makename character varying(100),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (makeid)
);

-- Party Master
CREATE TABLE IF NOT EXISTS public.tblmasparty (
    partyid bigint NOT NULL,
    partytype smallint,
    partycode character varying(20),
    partyname character varying(100),
    contactno character varying(15),
    address1 character varying(200),
    address2 character varying(200),
    accountid bigint,
    gstnum character varying(15),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (partyid)
);

-- Item Master
CREATE TABLE IF NOT EXISTS public.tblmasitem (
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
    billable boolean,
    opening_stock numeric(8,2),
    PRIMARY KEY (itemcode)
);

-- Company Master
CREATE TABLE IF NOT EXISTS public.tblmascompany (
    company_id bigint NOT NULL,
    company_name character varying(100),
    address1 character varying(200),
    address2 character varying(200),
    phone character varying(15),
    email character varying(50),
    gst_number character varying(15),
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (company_id)
);

-- Accounting Period Master
CREATE TABLE IF NOT EXISTS public.tblmasaccperiod (
    finyearid bigint NOT NULL,
    finyearname character varying(50),
    fydatefrom date,
    fydateto date,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (finyearid)
);

-- Purchase Master
CREATE TABLE IF NOT EXISTS public.tbltrnpurchase (
    tranid bigint NOT NULL,
    fyearid smallint,
    trno character varying(20),
    trdate date,
    suppinvno character varying(20),
    suppinvdt date,
    partyid bigint,
    remark character varying(200),
    invamt numeric(12,2),
    tptcharge numeric(12,2),
    labcharge numeric(12,2),
    misccharge numeric(12,2),
    packcharge numeric(12,2),
    rounded numeric(12,2),
    cgst numeric(12,2),
    sgst numeric(12,2),
    igst numeric(12,2),
    costsheetprepared boolean DEFAULT false,
    grnposted boolean DEFAULT false,
    costconfirmed boolean DEFAULT false,
    is_cancelled boolean DEFAULT false,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (tranid)
);

-- Purchase Detail
CREATE TABLE IF NOT EXISTS public.tbltrnpurchasedet (
    tranmasid bigint,
    srno smallint,
    itemcode bigint,
    qty numeric(12,2),
    rate numeric(12,2),
    invamount numeric(12,2),
    ohamt numeric(12,2),
    netrate numeric(12,2),
    rounded numeric(12,2),
    cgst numeric(12,2),
    sgst numeric(12,2),
    igst numeric(12,2),
    gtotal numeric(12,2),
    cgstp numeric(5,2),
    sgstp numeric(5,2),
    igstp numeric(5,2),
    fyearid smallint,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL
);

-- Stock Ledger (with auto-generated ID)
CREATE TABLE IF NOT EXISTS public.trn_stock_ledger (
    fyear_id smallint,
    stock_ledger_id bigint GENERATED ALWAYS AS IDENTITY,
    inv_master_id bigint,
    inv_detail_id bigint,
    itemcode bigint,
    tran_type character varying(5),
    tran_date date,
    unit character varying(6),
    qty numeric(12,2),
    PRIMARY KEY (stock_ledger_id)
);

-- Sales Invoice Master
CREATE TABLE IF NOT EXISTS public.trn_invoice_master (
    inv_master_id bigint GENERATED ALWAYS AS IDENTITY,
    fyear_id smallint,
    inv_no character varying(20),
    inv_date date,
    ref_no character varying(20),
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
    rounded_off numeric(12,2),
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    description text,
    is_posted boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (inv_master_id)
);

-- Purchase Return Master
CREATE TABLE IF NOT EXISTS public.trn_purchase_return_master (
    pret_id bigint GENERATED ALWAYS AS IDENTITY,
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
    edited_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (pret_id)
);

-- Insert default admin user (password: admin123)
INSERT INTO public.tblmasparty (partyid, partytype, partycode, partyname, contactno, address1, accountid) 
VALUES (1, 0, '1', 'Administrator', '1234567890', 'Admin Address', 1)
ON CONFLICT (partyid) DO NOTHING;

-- Insert default accounting period
INSERT INTO public.tblmasaccperiod (finyearid, finyearname, fydatefrom, fydateto)
VALUES (1, '2024-25', '2024-04-01', '2025-03-31')
ON CONFLICT (finyearid) DO NOTHING;

-- Login table
CREATE TABLE IF NOT EXISTS public.login (
    id bigint GENERATED ALWAYS AS IDENTITY,
    username character varying(50) NOT NULL UNIQUE,
    password character varying(255) NOT NULL,
    created_date timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

-- Insert default company
INSERT INTO public.tblmascompany (company_id, company_name, address1, phone, email)
VALUES (1, 'New Gen Auto', 'Your Address Here', '1234567890', 'info@newgenauto.com')
ON CONFLICT (company_id) DO NOTHING;

-- Insert default login user (username: admin, password: admin123)
INSERT INTO public.login (username, password)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;