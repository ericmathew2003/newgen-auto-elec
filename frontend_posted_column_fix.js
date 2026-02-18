/**
 * Frontend fix for posted column not updating in SalesPage.js
 * 
 * PROBLEM: After posting an invoice, the backend updates is_posted=true, 
 * but the frontend sales list still shows the checkbox as unchecked.
 * 
 * SOLUTION: The issue is likely in the handlePost function timing or state management.
 */

// ============================================================================
// OPTION 1: Replace the handlePost function in SalesPage.js with this version
// ============================================================================

const handlePost = async () => {
  if (!editing?.tranid) return;
  if (!header.Is_Confirmed) {
    setNotice({ open: true, type: 'error', message: 'Confirm invoice first' });
    return;
  }

  try {
    console.log('🚀 Posting invoice:', editing.tranid);
    
    // Post the invoice
    const response = await axios.post(`${API_BASE_URL}/api/sales/${editing.tranid}/post`, {}, getAuthHeaders());
    console.log('✅ Post API response:', response.data);
    
    // Update the header state immediately
    setHeader(h => ({ ...h, Is_Posted: true }));
    console.log('📝 Updated header state to posted');
    
    // Update the sales list state immediately (optimistic update)
    setSales(prevSales => {
      const updated = prevSales.map(sale => 
        sale.tranid === editing.tranid 
          ? { ...sale, is_posted: true }
          : sale
      );
      console.log('📝 Updated sales list state');
      return updated;
    });
    
    // Wait a moment for database to fully commit
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Refresh from server to ensure consistency
    console.log('🔄 Refreshing sales list from server...');
    await fetchSales();
    
    setNotice({ open: true, type: 'success', message: 'Invoice posted successfully' });
    console.log('✅ Post operation completed');
    
  } catch (e) {
    console.error('❌ Post error:', e);
    setNotice({ open: true, type: 'error', message: e.response?.data?.error || 'Failed to post invoice' });
  }
};

// ============================================================================
// OPTION 2: Add debugging to existing function (temporary)
// ============================================================================

const handlePostWithDebug = async () => {
  if (!editing?.tranid) return;
  if (!header.Is_Confirmed) {
    setNotice({ open: true, type: 'error', message: 'Confirm invoice first' });
    return;
  }

  try {
    console.log('=== POST DEBUG START ===');
    console.log('Invoice ID:', editing.tranid);
    
    // Check current state
    const beforeSale = sales.find(s => s.tranid === editing.tranid);
    console.log('Before posting - sale in list:', beforeSale);
    console.log('Before posting - is_posted:', beforeSale?.is_posted);
    
    await axios.post(`${API_BASE_URL}/api/sales/${editing.tranid}/post`, {}, getAuthHeaders());
    setHeader(h => ({ ...h, Is_Posted: true }));
    
    console.log('Calling fetchSales...');
    await fetchSales();
    console.log('fetchSales completed');
    
    // Check state after refresh
    setTimeout(() => {
      const afterSale = sales.find(s => s.tranid === editing.tranid);
      console.log('After posting - sale in list:', afterSale);
      console.log('After posting - is_posted:', afterSale?.is_posted);
      console.log('=== POST DEBUG END ===');
    }, 100);
    
    setNotice({ open: true, type: 'success', message: 'Invoice posted successfully' });
  } catch (e) {
    console.error(e);
    setNotice({ open: true, type: 'error', message: e.response?.data?.error || 'Failed to post invoice' });
  }
};

// ============================================================================
// OPTION 3: Force refresh with cache busting
// ============================================================================

const handlePostWithCacheBust = async () => {
  if (!editing?.tranid) return;
  if (!header.Is_Confirmed) {
    setNotice({ open: true, type: 'error', message: 'Confirm invoice first' });
    return;
  }

  try {
    await axios.post(`${API_BASE_URL}/api/sales/${editing.tranid}/post`, {}, getAuthHeaders());
    setHeader(h => ({ ...h, Is_Posted: true }));
    
    // Force refresh with cache busting
    const params = { _t: Date.now() }; // Cache buster
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (selectedFYearID) {
      params.fyearId = selectedFYearID;
    }
    
    const r = await axios.get(`${API_BASE_URL}/api/sales`, { params, ...getAuthHeaders() });
    const raw = r.data || [];
    const mapped = raw.map(x => ({
      tranid: x.inv_master_id,
      invno: x.inv_no,
      invdate: x.inv_date,
      customername: x.customer_name ?? '',
      taxabletot: x.taxable_tot ?? 0,
      cgst: x.cgst_amount ?? 0,
      sgst: x.sgst_amount ?? 0,
      igst: x.igst_amount ?? 0,
      totamount: x.tot_amount ?? 0,
      is_posted: !!x.is_posted,
      is_confirmed: !!x.is_confirmed,
    }));
    setSales(mapped);
    
    setNotice({ open: true, type: 'success', message: 'Invoice posted successfully' });
  } catch (e) {
    console.error(e);
    setNotice({ open: true, type: 'error', message: e.response?.data?.error || 'Failed to post invoice' });
  }
};

/**
 * INSTRUCTIONS:
 * 
 * 1. Try OPTION 1 first - replace the existing handlePost function
 * 2. If that doesn't work, try OPTION 2 to see debug output
 * 3. If still issues, try OPTION 3 with cache busting
 * 
 * The most likely issue is that fetchSales() is being called too quickly
 * before the database transaction commits, or there's a React state
 * update timing issue.
 */

export {
  handlePost,
  handlePostWithDebug,
  handlePostWithCacheBust
};