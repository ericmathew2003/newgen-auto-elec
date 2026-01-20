import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import API_BASE_URL from "./config/api";
import { useAuth } from "./contexts/AuthContext";

export default function AccountingPeriodSelector() {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchAccountingPeriods();
  }, []);

  const fetchAccountingPeriods = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/accounting-periods`);
      setPeriods(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load accounting periods");
      setLoading(false);
    }
  };

  const handlePeriodSelect = () => {
    if (!selectedPeriod) {
      setError("Please select an accounting period");
      return;
    }

    // Store selected FYearID globally
    localStorage.setItem("selectedFYearID", selectedPeriod);
    console.log("Stored FYearID in localStorage:", selectedPeriod);
    console.log("Verification - reading back:", localStorage.getItem("selectedFYearID"));
    
    // Navigate based on user role
    if (user?.role === 'SALES_STAFF') {
      navigate("/sale"); // Sales staff goes to sales page
    } else if (user?.role === 'ACCOUNTS_MANAGER' || user?.role === 'ACCOUNTS_STAFF') {
      navigate("/report"); // Accounts staff goes to reports page
    } else {
      navigate("/home"); // Admin goes to dashboard
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading accounting periods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Select Accounting Period
          </h1>
          <p className="text-gray-600">
            Choose the financial year for your current session
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
          >
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}

        <div className="space-y-4 mb-8">
          {periods.map((period) => (
            <motion.div
              key={period.finyearid}
              whileHover={{ scale: 1.02 }}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedPeriod === period.finyearid.toString()
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setSelectedPeriod(period.finyearid.toString())}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {period.finyearname}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatDate(period.fydatefrom)} - {formatDate(period.fydateto)}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedPeriod === period.finyearid.toString()
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-gray-300"
                }`}>
                  {selectedPeriod === period.finyearid.toString() && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {periods.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No accounting periods found</p>
          </div>
        )}

        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePeriodSelect}
            disabled={!selectedPeriod}
            className={`px-6 py-3 rounded-lg font-semibold ${
              selectedPeriod
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Continue
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}




