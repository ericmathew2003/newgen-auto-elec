import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiUsers,
  FiRefreshCw,
  FiBarChart2,
  FiSettings,
  FiDollarSign,
  FiMenu,
  FiX,
  FiChevronDown,
  FiChevronRight
} from 'react-icons/fi';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: FiHome,
      path: '/dashboard'
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: FiPackage,
      submenu: [
        { id: 'items', label: 'Items', path: '/items' },
        { id: 'brands', label: 'Brands', path: '/brands' },
        { id: 'groups', label: 'Groups', path: '/groups' },
        { id: 'makes', label: 'Makes', path: '/makes' }
      ]
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: FiShoppingCart,
      submenu: [
        { id: 'purchases', label: 'Purchases', path: '/purchases' },
        { id: 'sales', label: 'Sales', path: '/sales' },
        { id: 'returns', label: 'Returns', path: '/returns' }
      ]
    },
    {
      id: 'parties',
      label: 'Parties',
      icon: FiUsers,
      path: '/parties'
    },
    {
      id: 'accounts',
      label: 'Accounts',
      icon: FiDollarSign,
      submenu: [
        { id: 'group-master', label: 'Group Master', path: '/accounts/group-master' },
        { id: 'coa-master', label: 'Account Master', path: '/accounts/coa-master' }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FiBarChart2,
      submenu: [
        { id: 'stock-report', label: 'Stock Report', path: '/reports/stock' },
        { id: 'purchase-report', label: 'Purchase Report', path: '/reports/purchases' },
        { id: 'sales-report', label: 'Sales Report', path: '/reports/sales' }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: FiSettings,
      path: '/settings'
    }
  ];

  const toggleSubmenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const handleMenuClick = (item) => {
    if (item.submenu) {
      toggleSubmenu(item.id);
    } else {
      setActiveTab(item.id);
      if (item.path) {
        navigate(item.path);
      }
      setIsOpen(false);
    }
  };

  const handleSubmenuClick = (item) => {
    setActiveTab(item.id);
    if (item.path) {
      navigate(item.path);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed lg:static lg:translate-x-0 top-0 left-0 h-full w-80 bg-white shadow-xl z-50 lg:z-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FiPackage className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">InventoryPro</h1>
                <p className="text-sm text-gray-600">Management System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleMenuClick(item)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.submenu && (
                      <div className="ml-2">
                        {expandedMenus[item.id] ? (
                          <FiChevronDown className="w-4 h-4" />
                        ) : (
                          <FiChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Submenu */}
                  <AnimatePresence>
                    {item.submenu && expandedMenus[item.id] && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-8 mt-2 space-y-1 overflow-hidden"
                      >
                        {item.submenu.map((subItem) => (
                          <li key={subItem.id}>
                            <button
                              onClick={() => handleSubmenuClick(subItem)}
                              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                activeTab === subItem.id
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {subItem.label}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">A</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Admin User</p>
                <p className="text-xs text-gray-600">System Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Desktop sidebar spacer */}
      <div className="hidden lg:block w-80 flex-shrink-0" />
    </>
  );
};

export default Sidebar;