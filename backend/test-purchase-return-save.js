const pool = require("./db");

async function testPurchaseReturnSave() {
  console.log("Testing Purchase Return Save...\n");

  const testData = {
    header: {
      fyear_id: 1,
      purch_ret_no: null, // Will auto-generate
      tran_date: "2024-01-15",
      party_id: 107, // CONTINENTAL MOTORS
      remark: "Test return",
      taxable_total: 1000.00,
      cgst_amount: 90.00,
      sgst_amount: 90.00,
      igst_amount: 0.00,
      rounded_off: 0.00,
      total_amount: 1180.00,
      is_posted: false,
      deleted: false,
    },
    items: [
      {
        srno: 1,
        itemcode: 1,
        unit: "NOS",
        qty: 10,
        rate: 100,
        taxable_amount: 1000,
        cgst_per: 9,
        sgst_per: 9,
        igst_per: 0,
        cgst_amount: 90,
        sgst_amount: 90,
        igst_amount: 0,
        total_amount: 1180,
        description: "Test item",
        supp_inv_no: "INV001",
        supp_inv_date: "2024-01-10",
      },
    ],
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { header, items } = testData;
    const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

    // Auto-generate number
    await client.query("LOCK TABLE trn_purchase_return_master IN EXCLUSIVE MODE");
    const sql = header.fyear_id
      ? `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master WHERE fyear_id = $1`
      : `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master`;
    const params = header.fyear_id ? [header.fyear_id] : [];
    const r = await client.query(sql, params);
    const retNoToUse = r.rows[0]?.next_no || 1;

    console.log(`Generated Purchase Return No: ${retNoToUse}`);

    // Insert master
    const result = await client.query(
      `INSERT INTO trn_purchase_return_master
       (fyear_id, purch_ret_no, tran_date, party_id, description,
        taxable_total, cgst_amount, sgst_amount, igst_amount, rounded_off, total_amount, is_posted, is_deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING purch_ret_id, purch_ret_no`,
      [
        nn(header.fyear_id),
        nn(retNoToUse),
        nn(header.tran_date),
        nn(header.party_id),
        nn(header.remark),
        nn(header.taxable_total),
        nn(header.cgst_amount),
        nn(header.sgst_amount),
        nn(header.igst_amount),
        nn(header.rounded_off),
        nn(header.total_amount),
        !!header.is_posted,
        !!header.deleted,
      ]
    );

    const pret_id = result.rows[0]?.purch_ret_id;
    console.log(`Created Purchase Return ID: ${pret_id}`);

    // Insert items
    for (const it of items) {
      await client.query(
        `INSERT INTO trn_purchase_return_detail
         (purch_ret_master_id, srno, itemcode, unit, qty, rate, taxable_amount,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount, total_amount, 
          description, supp_inv_no, supp_inv_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          pret_id,
          nn(it.srno),
          nn(it.itemcode),
          it.unit ?? null,
          nn(it.qty ?? 0),
          nn(it.rate ?? 0),
          nn(it.taxable_amount ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          nn(it.total_amount ?? 0),
          it.description ?? null,
          it.supp_inv_no ?? null,
          nn(it.supp_inv_date),
        ]
      );
    }

    console.log(`Inserted ${items.length} item(s)`);

    await client.query("ROLLBACK"); // Rollback to avoid polluting the database
    console.log("\n✅ Test completed successfully (rolled back)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Test failed:");
    console.error(err.message);
    console.error("\nFull error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

testPurchaseReturnSave();