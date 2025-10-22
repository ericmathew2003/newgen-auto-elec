
CREATE TABLE login (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);

INSERT INTO login (username, password)
VALUES ('admin', '$2b$10$8R.OvTynMAlwCuz6Eubs0eyiAcJXGZID2nZIhbpuL6V8cFR2toTiq');

CREATE TABLE tblMasBrand (
    BrandID BIGINT PRIMARY KEY,
    BrandName VARCHAR(100),
    CreatedDate TIMESTAMP NOT NULL DEFAULT NOW(),
    EditedDate  TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE TABLE tblMasGroup (
    GroupID BIGINT PRIMARY KEY,
    GroupName VARCHAR(100),
    createddate TIMESTAMP NOT NULL DEFAULT NOW(),
    editeddate  TIMESTAMP NOT NULL DEFAULT NOW()
  );



CREATE TABLE tblMasMake (
    MakeID BIGINT PRIMARY KEY,
    MakeName VARCHAR(100),
    createddate TIMESTAMP NOT NULL DEFAULT NOW(),
    editeddate  TIMESTAMP NOT NULL DEFAULT NOW()
);  

CREATE TABLE tblMasParty (
   partyid bigint NOT NULL,
    partycode bigint,
    partytype smallint,
    partyname character varying(100) COLLATE pg_catalog."default",
    contactno character varying(20) COLLATE pg_catalog."default",
    address1 character varying(50) COLLATE pg_catalog."default",
    accountid smallint,
    gstnum character varying(30) COLLATE pg_catalog."default",
    address2 character varying(50) COLLATE pg_catalog."default",
    created_date timestamp without time zone NOT NULL DEFAULT now(),
    edited_date timestamp without time zone NOT NULL DEFAULT now(),
    PRIMARY KEY(partyid),
    CONSTRAINT fk_tblMasParty_accountid FOREIGN KEY(accountid) REFERENCES tblMasAccount(AccountID)  
);

-- tblMasItem
CREATE TABLE tblMasItem (
   itemcode bigint NOT NULL,
    groupid bigint,
    makeid bigint,
    brandid bigint,
    itemname character varying(200) COLLATE pg_catalog."default",
    packing character varying(20) COLLATE pg_catalog."default",
    suppref character varying(10) COLLATE pg_catalog."default",
    barcode character varying(15) COLLATE pg_catalog."default",
    cost numeric(12,2),
    avgcost numeric(12,2),
    curstock real,
    sprice numeric(12,2),
    mrp numeric(12,2),
    unit character varying(6) COLLATE pg_catalog."default",
    shelf character varying(10) COLLATE pg_catalog."default",
    partno character varying(20) COLLATE pg_catalog."default",
    model character varying(100) COLLATE pg_catalog."default",
    cgst numeric(5,2),
    sgst numeric(5,2),
    igst numeric(5,2),
    hsncode character varying(10) COLLATE pg_catalog."default",
    partyid bigint,
    isexpence boolean,
    deleted boolean,
    created_date timestamp without time zone NOT NULL DEFAULT now(),
    edited_date timestamp without time zone NOT NULL DEFAULT now(),
    billable boolean,
    PRIMARY KEY(itemcode),
    CONSTRAINT fk_tblMasItem_groupid FOREIGN KEY(groupid) REFERENCES tblMasGroup(GroupID),
    CONSTRAINT fk_tblMasItem_makeid FOREIGN KEY(makeid) REFERENCES tblMasMake(MakeID),
    CONSTRAINT fk_tblMasItem_brandid FOREIGN KEY(brandid) REFERENCES tblMasBrand(BrandID)   
);

-- tblTrnInvMas
CREATE TABLE tblTrnInvMas (
    FYearID SMALLINT REFERENCES tblFinYear(FinYearID),
    TranID BIGINT PRIMARY KEY,
    InvNo BIGINT,
    InvDate DATE,
    RefNo VARCHAR(15),
    PartyID BIGINT REFERENCES tblMasParty(PartyID),
    Customer VARCHAR(50),
    AccountID BIGINT,
    TaxableTot REAL,
    DisPerc REAL,
    DisAmt REAL,
    MiscPerAdd REAL,
    MiscAmtAdd REAL,
    TotAvgCost REAL,
    TotAmount REAL,
    TotCGST REAL,
    TotSGST REAL,
    TotIGST REAL,
    Remark VARCHAR(150),
    Deleted BOOLEAN,
    Selected BOOLEAN,
    CreatedDate TIMESTAMP NOT NULL DEFAULT NOW()
);

-- tblTrnInvDet
CREATE TABLE tblTrnInvDet (
    FYearID SMALLINT REFERENCES tblFinYear(FinYearID),
    InvID BIGINT,
    TranMasID BIGINT REFERENCES tblTrnInvMas(TranID),
    ItemCode BIGINT REFERENCES tblMasItem(ItemCode),
    Unit VARCHAR(6),
    Qty REAL,
    AvgCost REAL,
    TaxableRate REAL,
    CGSTPer REAL,
    SGSTPer REAL,
    IGSTPer REAL,
    CGSTAmount REAL,
    SGSTAmount REAL,
    IGSTAmount REAL,
    Rate REAL,
    DisPer REAL,
    DisAmt REAL,
    MiscAmount REAL,
    TotAmt REAL,
    Remark VARCHAR(50),
    Deleted BOOLEAN,
    PRIMARY KEY (InvID, ItemCode),
    CreatedDate TIMESTAMP
);

-- tblTrnPurchase
CREATE TABLE tblTrnPurchase (
    fyearid smallint,
    tranid bigint NOT NULL,
    trno bigint,
    trdate date,
    suppinvno character varying(20) COLLATE pg_catalog."default",
    suppinvdt date,
    partyid bigint,
    remark character varying(50) COLLATE pg_catalog."default",
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
    is_cancelled boolean DEFAULT FALSE,
    created_date timestamp without time zone DEFAULT now(),
    edited_date timestamp without time zone DEFAULT now()
    
);

-- tblTrnPurchaseDet
CREATE TABLE tblTrnPurchaseDet (
    fyearid smallint NOT NULL,
    trid bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
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
-- ========================================
-- Table: tblTrnPurchaseCosting
-- ========================================

CREATE TABLE tblTrnPurchaseCosting (
    CostTRID BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- Auto increment unique ID
    PruchMasID BIGINT NOT NULL,       -- FK to tblTrnPurchase(TranID)
    OHType VARCHAR(100) NOT NULL,     -- Overhead type (e.g., Freight, Duty, etc.)
    Amount NUMERIC(12,2) NOT NULL,    -- Overhead cost
    ReferenceNo VARCHAR(50),          -- Reference document / bill number
    OHDate DATE,                      -- Overhead incurred date
    Remark VARCHAR(200),              -- Notes/remarks

    -- Foreign key linking to Purchase Master
    CONSTRAINT fk_purchase FOREIGN KEY (PruchMasID)
        REFERENCES tblTrnPurchase(TranID)
);


CREATE INDEX idx_costing_pruchmasid ON tblTrnPurchaseCosting(PruchMasID);

-- ========================================
-- Table: trn_purchase_return_master
-- ========================================

CREATE TABLE trn_purchase_return_master (
    purch_ret_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fyear_id SMALLINT REFERENCES tblFinYear(FinYearID),
    purch_ret_no BIGINT,
    tran_date DATE NOT NULL,
    party_id BIGINT REFERENCES tblMasParty(PartyID),
    ref_no VARCHAR(50),
    supplier_inv_no VARCHAR(50),
    taxable_total NUMERIC(12,2) DEFAULT 0,
    cgst_amount NUMERIC(12,2) DEFAULT 0,
    sgst_amount NUMERIC(12,2) DEFAULT 0,
    igst_amount NUMERIC(12,2) DEFAULT 0,
    rounded_off NUMERIC(5,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    description VARCHAR(150),
    is_posted BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    edited_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Table: trn_purchase_return_detail
-- ========================================

CREATE TABLE trn_purchase_return_detail (
    purch_ret_detail_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purch_ret_master_id BIGINT NOT NULL REFERENCES trn_purchase_return_master(purch_ret_id),
    srno BIGINT,
    itemcode BIGINT REFERENCES tblMasItem(ItemCode),
    unit VARCHAR(6),
    qty NUMERIC(12,2),
    rate NUMERIC(12,2),
    taxable_amount NUMERIC(12,2),
    cgst_per NUMERIC(5,2),
    sgst_per NUMERIC(5,2),
    igst_per NUMERIC(5,2),
    cgst_amount NUMERIC(12,2),
    sgst_amount NUMERIC(12,2),
    igst_amount NUMERIC(12,2),
    total_amount NUMERIC(12,2),
    description VARCHAR(150),
    supp_inv_no VARCHAR(50),
    supp_inv_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- tblTrnLedger
CREATE TABLE tblTrnLedger (
    FYearID SMALLINT REFERENCES tblFinYear(FinYearID),
    trID BIGINT PRIMARY KEY,
    TranMasID BIGINT,
    ItemCode BIGINT REFERENCES tblMasItem(ItemCode),
    trType VARCHAR(5),
    Date DATE,
    Unit VARCHAR(6),
    Qty INTEGER 
);


CREATE TABLE tblFinYear (
    FinYearID BIGINT PRIMARY KEY,
    FinYearName VARCHAR(50),
    FYDateFrom TIMESTAMP,
    FYDateTo TIMESTAMP
);




























