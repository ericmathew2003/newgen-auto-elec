import axios from 'axios';

/**
 * Get the selected accounting period details from localStorage and API
 */
export const getSelectedAccountingPeriod = async () => {
  const selectedFYearID = localStorage.getItem("selectedFYearID");
  if (!selectedFYearID) {
    throw new Error("No accounting period selected");
  }

  try {
    const response = await axios.get("http://localhost:5000/api/accounting-periods");
    const periods = response.data;
    const selectedPeriod = periods.find(p => p.finyearid.toString() === selectedFYearID);
    
    if (!selectedPeriod) {
      throw new Error("Selected accounting period not found");
    }

    return {
      id: selectedPeriod.finyearid,
      name: selectedPeriod.finyearname,
      dateFrom: new Date(selectedPeriod.fydatefrom),
      dateTo: new Date(selectedPeriod.fydateto)
    };
  } catch (error) {
    console.error("Error fetching accounting period:", error);
    throw error;
  }
};

/**
 * Validate if a transaction date is within the selected accounting period
 */
export const validateTransactionDate = async (transactionDate) => {
  try {
    const period = await getSelectedAccountingPeriod();
    const txnDate = new Date(transactionDate);
    
    // Reset time to compare only dates
    const fromDate = new Date(period.dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = new Date(period.dateTo);
    toDate.setHours(23, 59, 59, 999);
    
    txnDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    
    const isValid = txnDate >= fromDate && txnDate <= toDate;
    
    return {
      isValid,
      period,
      message: isValid 
        ? "Date is within accounting period" 
        : `Transaction date must be between ${formatDate(period.dateFrom)} and ${formatDate(period.dateTo)}`
    };
  } catch (error) {
    return {
      isValid: false,
      period: null,
      message: error.message || "Error validating transaction date"
    };
  }
};

/**
 * Format date for display
 */
export const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Get today's date in YYYY-MM-DD format, but only if it's within the accounting period
 */
export const getDefaultTransactionDate = async () => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const validation = await validateTransactionDate(todayStr);
    
    if (validation.isValid) {
      return todayStr;
    } else {
      // If today is not in period, return the period start date
      return validation.period ? validation.period.dateFrom.toISOString().split('T')[0] : todayStr;
    }
  } catch (error) {
    // Fallback to today if there's an error
    return new Date().toISOString().split('T')[0];
  }
};