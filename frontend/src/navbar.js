// components/Navbar.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiBox,
  FiChevronDown,
  FiChevronRight,
  FiShoppingCart,
  FiDollarSign,
  FiFileText,
  FiMenu,
  FiX,
  FiLogOut,
  FiHome,
  FiBell,
  FiUsers,
  FiBarChart2,
  FiLayers,
  FiCreditCard,
  FiTrendingUp,
  FiBookOpen,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiMinusCircle,
  FiPlusCircle,
  FiSettings,
} from "react-icons/fi";

import logo2 from "./assets/logo2.png";
import API_BASE_URL from "./config/api";
import { useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";

export default function Navbar() {
  const { canView } = usePermissions();
  
  // Main dropdown states
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);

  // Inventory sub-menu states
  const [masterOpen, setMasterOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  // Accounts sub-menu states
  const [accountsMasterOpen, setAccountsMasterOpen] = useState(false);
  const [accountsTransactionsOpen, setAccountsTransactionsOpen] = useState(false);
  const [accountsReportsOpen, setAccountsReportsOpen] = useState(false);
  const [accountsSettingsOpen, setAccountsSettingsOpen] = useState(false);

  // Settings menu states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Other states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/notifications`);
      setNotifications(response.data || []);
      setNotificationCount(response.data?.length || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
      setNotificationCount(0);
    }
  };

  // Fetch notifications on component mount and every 5 minutes
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);

    try {
      // Add a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use AuthContext logout
      logout();

      // Navigate to entry page
      navigate('/');

      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      // Still navigate even if there's an error
      navigate('/');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-lg px-0 py-0 flex items-center justify-between z-50 backdrop-blur-sm bg-white/95">
        {/* Left side - Menu button and Logo */}
        <div className="flex items-center space-x-6">
          <button
            onClick={toggleSidebar}
            className="p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:shadow-md group"
            title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {sidebarOpen ? (
              <FiX size={20} className="text-gray-600 group-hover:text-gray-800" />
            ) : (
              <FiMenu size={20} className="text-gray-600 group-hover:text-gray-800" />
            )}
          </button>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={logo2}
                alt="NewGen Logo"
                className="w-10 h-10 rounded-lg shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">NewGen</h1>
              <span className="text-xs text-gray-500 font-medium">Enterprise Solutions</span>
            </div>
          </div>
        </div>

        {/* Center - Empty space (search bar removed) */}
        <div className="flex-1"></div>

        {/* Right side - Notifications and Logout */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:shadow-md group"
              title="Notifications"
            >
              <FiBell size={20} className="text-gray-600 group-hover:text-gray-800" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <button
                    onClick={fetchNotifications}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    title="Refresh notifications"
                  >
                    Refresh
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification, index) => (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${index < notifications.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                      >
                        <div className="flex items-start space-x-2">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notification.type === 'error' ? 'bg-red-500' :
                            notification.type === 'warning' ? 'bg-yellow-500' :
                              notification.type === 'success' ? 'bg-green-500' :
                                'bg-blue-500'
                            }`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.timestamp).toLocaleDateString()} {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 w-full text-center"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium"
          >
            <FiLogOut size={16} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Enhanced Sidebar */}
      <div
        className={`fixed left-0 top-20 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40 shadow-xl ${sidebarOpen ? "w-72" : "w-0"
          }`}
      >
        <div className={`h-full overflow-y-auto overflow-x-hidden transition-opacity duration-300 sidebar-scroll ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-6 pb-20">
            {/* Sidebar Header */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Navigation</h2>
              <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
            </div>

            <nav className="space-y-2">
              {/* 1. DASHBOARD SECTION */}
              <div className="space-y-2">
                <button
                  onClick={() => setDashboardOpen(!dashboardOpen)}
                  className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700 transition-all duration-200 group border border-transparent hover:border-blue-100"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors duration-200 mr-4">
                      <FiBarChart2 size={18} className="text-blue-600" />
                    </div>
                    <span className="font-medium">Dashboard</span>
                  </div>
                  <div className="p-1 rounded-md bg-gray-100 group-hover:bg-blue-100 transition-colors duration-200">
                    {dashboardOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                </button>

                {dashboardOpen && (
                  <div className="ml-8 space-y-1 animate-fadeIn">
                    <Link
                      to="/home"
                      className="flex items-center p-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 text-sm font-medium"
                    >
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                      Main Dashboard
                    </Link>
                  </div>
                )}
              </div>

              {/* 2. INVENTORY SECTION */}
              {canView('INVENTORY', 'ITEM_MASTER') && (
              <div className="space-y-2">
                <button
                  onClick={() => setInventoryOpen(!inventoryOpen)}
                  className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 transition-all duration-200 group border border-transparent hover:border-green-100"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors duration-200 mr-4">
                      <FiLayers size={18} className="text-green-600" />
                    </div>
                    <span className="font-medium">Inventory</span>
                  </div>
                  <div className="p-1 rounded-md bg-gray-100 group-hover:bg-green-100 transition-colors duration-200">
                    {inventoryOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                </button>

                {inventoryOpen && (
                  <div className="ml-4 space-y-2 animate-fadeIn">
                    {/* Master Data */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setMasterOpen(!masterOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiBox size={16} className="text-orange-600 mr-3" />
                          <span>Master Data</span>
                        </div>
                        <div className="p-1">
                          {masterOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {masterOpen && (
                        <div className="ml-6 space-y-1">
                          <Link to="/groups" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Groups
                          </Link>
                          <Link to="/makes" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Makes
                          </Link>
                          <Link to="/brands" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Brands
                          </Link>
                          <Link to="/items" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Item Master
                          </Link>
                          <Link to="/suppliers" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Suppliers
                          </Link>
                          <Link to="/customers" className="flex items-center p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                            Customers
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Purchase Section */}
                    {(canView('INVENTORY', 'PURCHASE') || canView('INVENTORY', 'PURCHASE_RETURN')) && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setPurchaseOpen(!purchaseOpen)}
                          className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-green-50 hover:text-green-700 transition-all duration-200 text-sm font-medium"
                        >
                          <div className="flex items-center">
                            <FiShoppingCart size={16} className="text-green-600 mr-3" />
                            <span>Purchase</span>
                          </div>
                          <div className="p-1">
                            {purchaseOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                          </div>
                        </button>

                        {purchaseOpen && (
                          <div className="ml-6 space-y-1">
                            {canView('INVENTORY', 'PURCHASE') && (
                              <Link to="/purchase" className="flex items-center p-2 rounded-lg hover:bg-green-50 hover:text-green-700 transition-all duration-200 text-xs font-medium">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></div>
                                Purchase
                              </Link>
                            )}
                            {canView('INVENTORY', 'PURCHASE_RETURN') && (
                              <Link to="/purchase-return" className="flex items-center p-2 rounded-lg hover:bg-green-50 hover:text-green-700 transition-all duration-200 text-xs font-medium">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></div>
                                Purchase Return
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sales */}
                    {canView('INVENTORY', 'SALES') && (
                      <Link to="/sale" className="flex items-center p-3 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200 text-sm font-medium">
                        <FiDollarSign size={16} className="text-emerald-600 mr-3" />
                        <span>Sales</span>
                      </Link>
                    )}

                    {/* Inventory Reports */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setReportsOpen(!reportsOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiFileText size={16} className="text-purple-600 mr-3" />
                          <span>Reports</span>
                        </div>
                        <div className="p-1">
                          {reportsOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {reportsOpen && (
                        <div className="ml-6 space-y-1">
                          <Link to="/report" className="flex items-center p-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></div>
                            GST Invoice Report
                          </Link>
                          <Link to="/sales-purchase-reports" className="flex items-center p-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></div>
                            Sales Report
                          </Link>
                          <Link to="/ml-reports" className="flex items-center p-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></div>
                            ML Reports & Analytics
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* 3. ACCOUNTS SECTION */}
              <div className="space-y-2">
                <button
                  onClick={() => setAccountsOpen(!accountsOpen)}
                  className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-700 transition-all duration-200 group border border-transparent hover:border-indigo-100"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors duration-200 mr-4">
                      <FiCreditCard size={18} className="text-indigo-600" />
                    </div>
                    <span className="font-medium">Accounts</span>
                  </div>
                  <div className="p-1 rounded-md bg-gray-100 group-hover:bg-indigo-100 transition-colors duration-200">
                    {accountsOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                </button>

                {accountsOpen && (
                  <div className="ml-4 space-y-2 animate-fadeIn">
                    {/* Accounts Masters */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setAccountsMasterOpen(!accountsMasterOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiBookOpen size={16} className="text-indigo-600 mr-3" />
                          <span>Masters</span>
                        </div>
                        <div className="p-1">
                          {accountsMasterOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {accountsMasterOpen && (
                        <div className="ml-6 space-y-1">
                          {canView('ACCOUNTS', 'GROUP_MASTER') && (
                            <Link to="/accounts/group-master" className="flex items-center p-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></div>
                              Group Master
                            </Link>
                          )}
                          {canView('ACCOUNTS', 'COA_MASTER') && (
                            <Link to="/accounts/coa-master" className="flex items-center p-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></div>
                              Account Master
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Accounts Transactions */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setAccountsTransactionsOpen(!accountsTransactionsOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiTrendingUp size={16} className="text-teal-600 mr-3" />
                          <span>Transactions</span>
                        </div>
                        <div className="p-1">
                          {accountsTransactionsOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {accountsTransactionsOpen && (
                        <div className="ml-6 space-y-1">
                          {canView('ACCOUNTS', 'JOURNAL_VOUCHER') && (
                            <Link to="/accounts/journal-voucher" className="flex items-center p-2 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></div>
                              Journal Voucher
                            </Link>
                          )}
                          {canView('ACCOUNTS', 'PAYMENTS') && (
                            <Link to="/accounts/payments" className="flex items-center p-2 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></div>
                              Payments
                            </Link>
                          )}
                          {canView('ACCOUNTS', 'RECEIPTS') && (
                            <Link to="/accounts/receipts" className="flex items-center p-2 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></div>
                              Receipts
                            </Link>
                          )}
                          {canView('ACCOUNTS', 'DEBIT_NOTE') && (
                            <Link to="/accounts/debit-note" className="flex items-center p-2 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></div>
                              Debit Note
                            </Link>
                          )}
                          {canView('ACCOUNTS', 'CREDIT_NOTE') && (
                            <Link to="/accounts/credit-note" className="flex items-center p-2 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></div>
                              Credit Note
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Accounts Reports */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setAccountsReportsOpen(!accountsReportsOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiFileText size={16} className="text-pink-600 mr-3" />
                          <span>Reports</span>
                        </div>
                        <div className="p-1">
                          {accountsReportsOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {accountsReportsOpen && (
                        <div className="ml-6 space-y-1">
                          <Link to="/accounts/trial-balance" className="flex items-center p-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-pink-400 rounded-full mr-2"></div>
                            Trial Balance
                          </Link>
                          <Link to="/accounts/profit-loss" className="flex items-center p-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-pink-400 rounded-full mr-2"></div>
                            Profit & Loss
                          </Link>
                          <Link to="/accounts/balance-sheet" className="flex items-center p-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-pink-400 rounded-full mr-2"></div>
                            Balance Sheet
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Accounts Settings */}
                    {canView('ACCOUNTS', 'DYNAMIC_MAPPING') && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setAccountsSettingsOpen(!accountsSettingsOpen)}
                          className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-sm font-medium"
                        >
                          <div className="flex items-center">
                            <FiSettings size={16} className="text-purple-600 mr-3" />
                            <span>Settings</span>
                          </div>
                          <div className="p-1">
                            {accountsSettingsOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                          </div>
                        </button>

                      {accountsSettingsOpen && (
                        <div className="ml-6 space-y-1">
                          {canView('ACCOUNTS', 'DYNAMIC_MAPPING') && (
                            <Link to="/accounts/settings/dynamic-transaction-mapping" className="flex items-center p-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-xs font-medium">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></div>
                              Dynamic Transaction Mapping
                            </Link>
                          )}
                        </div>
                      )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. SETTINGS SECTION */}
              {canView('SECURITY', 'USER_MANAGEMENT') && (
              <div className="space-y-2">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-700 transition-all duration-200 group border border-transparent hover:border-gray-100"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors duration-200 mr-4">
                      <FiSettings size={18} className="text-gray-600" />
                    </div>
                    <span className="font-medium">Settings</span>
                  </div>
                  <div className="p-1 rounded-md bg-gray-100 group-hover:bg-gray-100 transition-colors duration-200">
                    {settingsOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                </button>

                {settingsOpen && (
                  <div className="ml-4 space-y-2 animate-fadeIn">
                    {/* Security */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setSecurityOpen(!securityOpen)}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-sm font-medium"
                      >
                        <div className="flex items-center">
                          <FiUsers size={16} className="text-red-600 mr-3" />
                          <span>Security</span>
                        </div>
                        <div className="p-1">
                          {securityOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                      </button>

                      {securityOpen && (
                        <div className="ml-6 space-y-1">
                          <Link to="/settings/security/user-management" className="flex items-center p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></div>
                            User Management
                          </Link>
                          <Link to="/settings/security/role-management" className="flex items-center p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></div>
                            Role Management
                          </Link>
                          <Link to="/settings/security/permission-assignment" className="flex items-center p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></div>
                            Permission / Rights Assignment
                          </Link>
                          <Link to="/settings/security/user-role-review" className="flex items-center p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-xs font-medium">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></div>
                            User Role Review
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}

            </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${sidebarOpen ? "ml-72" : "ml-0"
          }`}
      >
        <div className="pt-20 p-8 bg-gray-50 min-h-screen">
          {/* Your page content will go here */}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <FiLogOut className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Logout</h3>
                <p className="text-sm text-gray-600">Are you sure you want to logout?</p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom CSS for animations and scrollbar */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        /* Custom scrollbar styling */
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}