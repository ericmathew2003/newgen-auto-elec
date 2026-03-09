import React from 'react';

const CashFlowAnalytics = ({ customers, suppliers, paymentPatterns, anomalies, alertHistory, onClearAlerts }) => {
  const [categories, setCategories] = React.useState([]);
  
  React.useEffect(() => {
    fetchCategories();
  }, []);
  
  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:8001/analytics/categories?days=90');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskColor = (level) => {
    const colors = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Transaction Categories Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-purple-600 mr-2">📊</span>
          Cash Flow by Transaction Category (Last 90 Days)
        </h3>
        {categories && categories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inflow</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outflow</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Flow</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.display_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{cat.transaction_count}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                      {formatCurrency(cat.total_inflow)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">
                      {formatCurrency(cat.total_outflow)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${
                      cat.net_flow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(cat.net_flow)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <div className={`h-2 rounded ${
                          cat.net_flow > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`} style={{width: `${Math.min(Math.abs(cat.net_flow) / 1000, 100)}px`}}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No category data available</p>
            <p className="text-sm mt-2">Transaction categories will appear here</p>
          </div>
        )}
      </div>

      {/* Customer/Supplier Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="text-green-600 mr-2">💰</span>
            Top Customers (Cash Inflow)
          </h3>
          {customers && customers.length > 0 ? (
            <div className="space-y-3">
              {customers.map((customer, idx) => (
                <div key={idx} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-600">
                        {customer.invoice_count} invoices • Avg: {formatCurrency(customer.avg_invoice_value)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{formatCurrency(customer.total_inflow)}</div>
                      <div className="text-xs text-gray-500">{customer.last_transaction}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No customer data available</p>
              <p className="text-sm mt-2">Post more sales invoices to see analysis</p>
            </div>
          )}
        </div>

        {/* Top Suppliers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="text-red-600 mr-2">🏭</span>
            Top Suppliers (Cash Outflow)
          </h3>
          {suppliers && suppliers.length > 0 ? (
            <div className="space-y-3">
              {suppliers.map((supplier, idx) => (
                <div key={idx} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-600">
                        {supplier.purchase_count} purchases • Avg: {formatCurrency(supplier.avg_purchase_value)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{formatCurrency(supplier.total_outflow)}</div>
                      <div className="text-xs text-gray-500">{supplier.last_transaction}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No supplier data available</p>
              <p className="text-sm mt-2">Post more purchase invoices to see analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Patterns & Credit Risk */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-orange-600 mr-2">⚠️</span>
          Payment Patterns & Credit Risk
        </h3>
        {paymentPatterns && paymentPatterns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paymentPatterns.map((pattern, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{pattern.name}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                      {formatCurrency(pattern.outstanding_balance)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{pattern.avg_days_outstanding}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getRiskColor(pattern.risk_level)}`}>
                        {pattern.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{pattern.invoice_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No payment pattern data available</p>
            <p className="text-sm mt-2">All invoices are paid or no outstanding balances</p>
          </div>
        )}
      </div>

      {/* Alert History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="text-blue-600 mr-2">📋</span>
            Alert History
          </h3>
          {alertHistory && alertHistory.length > 0 && (
            <button
              onClick={onClearAlerts}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        {alertHistory && alertHistory.length > 0 ? (
          <div className="space-y-2">
            {alertHistory.map((alert, idx) => (
              <div key={idx} className="border-b pb-2 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        alert.type === 'CRITICAL' ? 'bg-red-500' :
                        alert.type === 'WARNING' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></span>
                      <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                    </div>
                    <div className="text-xs text-gray-600 ml-4 mt-1">{alert.message}</div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : alert.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No alerts in history</p>
            <p className="text-sm mt-2">Alerts will appear here when triggered</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowAnalytics;
