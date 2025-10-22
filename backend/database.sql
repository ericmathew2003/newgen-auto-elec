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