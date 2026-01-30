import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  BarChart3,
  Activity,
  ShoppingCart,
  Box,
  RefreshCw,
  Calendar,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import API_BASE_URL from "./config/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [data, setData] = useState({
    metrics: {
      totalPurchase: 0,
      totalPurchaseTax: 0,
      purchaseCount: 0,
      totalSales: 0,
      totalSalesTax: 0,
      salesCount: 0,
      suppliers: 0,
      customers: 0,
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalStockValue: 0,
    },
    charts: {
      purchaseMonthly: [], salesMonthly: [],
      topSellingItems: [],
      stockByCategory: [],
      recentTransactions: []
    },
  });

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Fetch low stock items
  const fetchLowStockItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/low-stock-items`, getAuthHeaders());
      const lowStock = res.data || [];
      setLowStockItems(lowStock);
      setShowLowStockModal(true);
    } catch (err) {
      console.error("Failed to fetch low stock items:", err);
      if (err.response?.status === 403) {
        setError("Access denied. Please check your permissions.");
      } else if (err.response?.status === 401) {
        setError("Please log in again to view stock details.");
      } else {
        setError("Failed to load low stock items");
      }
      // Show modal anyway with empty data and error message
      setLowStockItems([]);
      setShowLowStockModal(true);
    }
  };

  // Fetch out of stock items
  const fetchOutOfStockItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/out-of-stock-items`, getAuthHeaders());
      const outOfStock = res.data || [];
      setOutOfStockItems(outOfStock);
      setShowOutOfStockModal(true);
    } catch (err) {
      console.error("Failed to fetch out of stock items:", err);
      if (err.response?.status === 403) {
        setError("Access denied. Please check your permissions.");
      } else if (err.response?.status === 401) {
        setError("Please log in again to view stock details.");
      } else {
        setError("Failed to load out of stock items");
      }
      // Show modal anyway with empty data and error message
      setOutOfStockItems([]);
      setShowOutOfStockModal(true);
    }
  };

  // Manual refresh function
  const refreshDashboardData = async () => {
    try {
      setError("");
      setLoading(true);
      console.log('Manually refreshing dashboard data...');
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/summary`, getAuthHeaders());
      setData(res.data);
      console.log('Dashboard data refreshed:', res.data);
    } catch (err) {
      console.error("Dashboard refresh error:", err);
      setError("Failed to refresh dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setError("");
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/dashboard/summary`, getAuthHeaders());
        if (isMounted) {
          setData(res.data);
        }
      } catch (err) {
        console.error("Dashboard API error:", err);
        if (isMounted) {
          if (err.response?.status === 403) {
            setError("Access denied. Please check your permissions or try logging in again.");
          } else if (err.response?.status === 401) {
            setError("Authentication required. Please log in again.");
          } else {
            setError("Failed to load dashboard data. Using default values.");
          }

          // Set default data when API fails
          setData({
            metrics: {
              totalPurchase: 0,
              totalPurchaseTax: 0,
              purchaseCount: 0,
              totalSales: 0,
              totalSalesTax: 0,
              salesCount: 0,
              suppliers: 0,
              customers: 0,
              totalItems: 0,
              lowStockItems: 0,
              outOfStockItems: 0,
              totalStockValue: 0,
            },
            charts: {
              purchaseMonthly: [],
              salesMonthly: []
            }
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatCurrency = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  };

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                  <Activity className="text-white" size={28} />
                </div>
                Dashboard Overview
              </h1>
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                <Calendar size={16} />
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshDashboardData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
              </button>
              <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                  <Zap size={16} />
                  <span className="font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Inventory Value"
            value={formatCurrency(data.metrics.totalStockValue || 0)}
            change="+12%"
            changeType="positive"
            icon={<Box />}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
          />
          <MetricCard
            title="Monthly Sales"
            value={formatCurrency(data.metrics.totalSales)}
            change="+8%"
            changeType="positive"
            icon={<TrendingUp />}
            color="bg-gradient-to-r from-green-500 to-green-600"
          />
          <MetricCard
            title="Monthly Purchases"
            value={formatCurrency(data.metrics.totalPurchase)}
            change="+15%"
            changeType="positive"
            icon={<ShoppingBag />}
            color="bg-gradient-to-r from-purple-500 to-purple-600"
          />
          <MetricCard
            title="Low Stock Items"
            value={data.metrics.lowStockItems || 0}
            change="Critical"
            changeType="critical"
            icon={<AlertTriangle />}
            color="bg-gradient-to-r from-orange-500 to-red-500"
            onClick={fetchLowStockItems}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Items"
            value={formatNumber(data.metrics.totalItems || 0)}
            change="Active"
            changeType="positive"
            icon={<Package />}
            color="bg-gradient-to-r from-indigo-500 to-indigo-600"
          />
          <MetricCard
            title="Suppliers"
            value={formatNumber(data.metrics.suppliers || 0)}
            change="Online"
            changeType="positive"
            icon={<Users />}
            color="bg-gradient-to-r from-teal-500 to-teal-600"
          />
          <MetricCard
            title="Customers"
            value={formatNumber(data.metrics.customers || 0)}
            change="+5%"
            changeType="positive"
            icon={<Users />}
            color="bg-gradient-to-r from-pink-500 to-pink-600"
          />
          <MetricCard
            title="Out of Stock"
            value={data.metrics.outOfStockItems || 0}
            change="Urgent"
            changeType="critical"
            icon={<Target />}
            color="bg-gradient-to-r from-red-500 to-red-600"
            onClick={fetchOutOfStockItems}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard title="Sales & Purchase Trends" className="lg:col-span-2">
            <div className="h-80">
              <Line
                data={{
                  labels: (data.charts?.purchaseMonthly || []).map((d) => d.ym),
                  datasets: [{
                    label: "Monthly Purchase",
                    data: (data.charts?.purchaseMonthly || []).map((d) => Number(d.total || 0)),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                  }, {
                    label: "Monthly Sales",
                    data: (data.charts?.salesMonthly || []).map((d) => Number(d.total || 0)),
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#ffffff',
                      bodyColor: '#ffffff',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      cornerRadius: 8,
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: "rgba(0,0,0,0.05)",
                      },
                      ticks: {
                        callback: (v) => formatCurrency(v),
                      }
                    },
                    x: {
                      grid: { display: false },
                    }
                  }
                }}
              />
            </div>
          </ChartCard>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap size={20} className="text-blue-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              title="View Items"
              description="Manage inventory items"
              icon={<Package />}
              color="bg-blue-500"
              onClick={() => window.location.href = '/items'}
            />
            <QuickActionCard
              title="New Purchase"
              description="Create purchase order"
              icon={<ShoppingCart />}
              color="bg-green-500"
              onClick={() => window.location.href = '/purchase/new'}
            />
            <QuickActionCard
              title="Sales Report"
              description="View sales analytics"
              icon={<BarChart3 />}
              color="bg-purple-500"
              onClick={() => window.location.href = '/sales-purchase-reports'}
            />
            <QuickActionCard
              title="Suppliers"
              description="Manage suppliers"
              icon={<Users />}
              color="bg-orange-500"
              onClick={() => window.location.href = '/suppliers'}
            />
          </div>
        </div>

        {/* Modals */}
        {showLowStockModal && (
          <LowStockModal
            items={lowStockItems}
            onClose={() => setShowLowStockModal(false)}
          />
        )}

        {showOutOfStockModal && (
          <OutOfStockModal
            items={outOfStockItems}
            onClose={() => setShowOutOfStockModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// Modern Metric Card Component
const MetricCard = ({ title, value, change, changeType, icon, color, onClick }) => (
  <div
    className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        {React.cloneElement(icon, { size: 24, className: "text-white" })}
      </div>
      {change && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${changeType === 'positive' ? 'bg-green-100 text-green-700' :
          changeType === 'negative' ? 'bg-red-100 text-red-700' :
            'bg-orange-100 text-orange-700'
          }`}>
          {changeType === 'positive' ? <ArrowUpRight size={12} /> :
            changeType === 'negative' ? <ArrowDownRight size={12} /> :
              <AlertTriangle size={12} />}
          {change}
        </div>
      )}
    </div>
    <div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-gray-600 text-sm">{title}</p>
    </div>
  </div>
);

// Chart Card Component
const ChartCard = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <BarChart3 size={20} className="text-blue-600" />
      {title}
    </h3>
    {children}
  </div>
);

// Quick Action Card
const QuickActionCard = ({ title, description, icon, color, onClick }) => (
  <div
    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer hover:scale-105"
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        {React.cloneElement(icon, { size: 20, className: "text-white" })}
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  </div>
);

// Low Stock Modal Component
function LowStockModal({ items, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Low Stock Items</h2>
              <p className="text-sm text-gray-500">Items that need immediate attention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package className="text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
              <p className="text-gray-500">No items are currently low in stock.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-red-600">{items.length}</span> items with low stock
                </p>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="font-medium">{item.itemname}</span>
                    <span className="text-orange-600 font-semibold">Stock: {item.curstock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Items with stock ≤ 10 are considered low stock
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => window.location.href = '/items'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Out of Stock Modal Component
function OutOfStockModal({ items, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <Target className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Out of Stock Items</h2>
              <p className="text-sm text-gray-500">Items that are completely out of stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package className="text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Great News!</h3>
              <p className="text-gray-500">No items are currently out of stock.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-red-600">{items.length}</span> items that are out of stock
                </p>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-medium">{item.itemname}</span>
                    <span className="text-red-600 font-semibold">Out of Stock</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Items with 0 stock require immediate restocking
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => window.location.href = '/purchase/new'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Create Purchase Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
