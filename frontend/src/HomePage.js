import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { FiTrendingUp, FiShoppingBag, FiUsers, FiUserCheck, FiPackage, FiAlertTriangle, FiDollarSign, FiTruck, FiBarChart, FiActivity, FiShoppingCart, FiBox, FiSettings, FiRefreshCw } from "react-icons/fi";
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
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

  // Fetch low stock items
  const fetchLowStockItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items/all`);
      const allItems = res.data || [];
      // Filter items with low stock (assuming stock <= 10 is low stock)
      const lowStock = allItems.filter(item => {
        const stock = Number(item.curstock || 0);
        return stock > 0 && stock <= 10; // Items with 1-10 stock are low stock
      });
      setLowStockItems(lowStock);
      setShowLowStockModal(true);
    } catch (err) {
      console.error("Failed to fetch low stock items:", err);
      setError("Failed to load low stock items");
    }
  };

  // Fetch out of stock items
  const fetchOutOfStockItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items/all`);
      const allItems = res.data || [];
      // Filter items with zero stock
      const outOfStock = allItems.filter(item => {
        const stock = Number(item.curstock || 0);
        return stock === 0; // Items with 0 stock are out of stock
      });
      setOutOfStockItems(outOfStock);
      setShowOutOfStockModal(true);
    } catch (err) {
      console.error("Failed to fetch out of stock items:", err);
      setError("Failed to load out of stock items");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setError("");
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/dashboard/summary`);
        if (isMounted) {
          setData(res.data);
        }
      } catch (err) {
        if (isMounted) setError("Failed to load dashboard data");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const labels = (data.charts?.purchaseMonthly || []).map((d) => d.ym);
    const purchaseValues = (data.charts?.purchaseMonthly || []).map((d) => Number(d.total || 0));
    const salesValues = (data.charts?.salesMonthly || []).map((d) => Number(d.total || 0));
    return {
      labels,
      datasets: [{
        label: "Monthly Purchase Amount",
        data: purchaseValues,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        fill: true,
        borderWidth: 3,
      }, {
        label: "Monthly Sales Amount",
        data: salesValues,
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#8b5cf6",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        fill: true,
        borderWidth: 3,
      },],
    };
  }, [data]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        }
      },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0,0,0,0.05)",
          drawBorder: false,
        },
        ticks: {
          callback: (v) => shortCurrency(v),
          color: 'rgba(107, 114, 128, 0.8)',
          font: {
            size: 12,
          }
        },
        border: {
          display: false,
        }
      },
      x: {
        ticks: {
          autoSkip: true, maxTicksLimit: 12,
          color: 'rgba(107, 114, 128, 0.8)',
          font: {
            size: 12,
          }
        },
        grid: { display: false },
        border: {
          display: false,
        }
      },
    },
  }), []);

  const lastMonthPurchaseDelta = useMemo(() => {
    const series = data.charts?.purchaseMonthly || [];
    if (series.length < 2) return { pct: 0, up: true };
    const last = Number(series[series.length - 1].total || 0);
    const prev = Number(series[series.length - 2].total || 0);
    if (prev === 0) return { pct: 100, up: true };
    const pct = ((last - prev) / prev) * 100;
    return { pct: Math.round(pct), up: pct >= 0 };
  }, [data]);

  const lastMonthSalesDelta = useMemo(() => {
    const series = data.charts?.salesMonthly || [];
    if (series.length < 2) return { pct: 0, up: true };
    const last = Number(series[series.length - 1].total || 0);
    const prev = Number(series[series.length - 2].total || 0);
    if (prev === 0) return { pct: 100, up: true };
    const pct = ((last - prev) / prev) * 100;
    return { pct: Math.round(pct), up: pct >= 0 };
  }, [data]);

  return (
    <div className="p-4 lg:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <FiSettings className="text-white text-xl" />
              </div>
              Auto Spare Parts Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Complete inventory management overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FiRefreshCw className="text-sm" />
              <span className="text-sm">Refresh</span>
            </button>
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <QuickStat label="Today's Sales" value="₹45,230" change="+12%" positive={true}
            icon={<FiDollarSign />}
          />
          <QuickStat label="Pending Orders" value="23" change="-5%" positive={false}
            icon={<FiShoppingCart />}
          />
          <QuickStat label="Low Stock Alerts" value={data.metrics.lowStockItems || 8} change="Critical" critical={true}
            icon={<FiAlertTriangle />}
            onClick={fetchLowStockItems}
            clickable={true}
          />
          <QuickStat label="Active Suppliers" value={data.metrics.suppliers || 0} change="Online" positive={true}
            icon={<FiTruck />}
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center">
            <FiRefreshCw className="animate-spin text-2xl text-blue-600 mr-3" />
            <span>Loading dashboard data...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-6 rounded-2xl border border-red-200 dark:border-red-800 mb-6 flex items-center gap-3">
          <FiAlertTriangle className="text-xl" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard title="Total Inventory Value" value={formatCurrency(data.metrics.totalStockValue || 2500000)} accent="blue" icon={<FiBox />} footer={{ icon: <FiTrendingUp />, text: `${Math.abs(lastMonthPurchaseDelta.pct)}% vs last month`, up: lastMonthPurchaseDelta.up }} />
            <KPICard title="Total Items" value={formatNumber(data.metrics.totalItems || 2107)} accent="emerald" icon={<FiPackage />} footer={{ icon: <FiActivity />, text: `${data.metrics.lowStockItems || 8} low stock items`, up: false }} />
            <KPICard title="Monthly Sales" value={formatCurrency(data.metrics.totalSales)} accent="purple" icon={<FiBarChart />} footer={{ icon: <FiTrendingUp />, text: `${Math.abs(lastMonthSalesDelta.pct)}% vs last month`, up: lastMonthSalesDelta.up }} />
            <KPICard title="Monthly Purchases" value={formatCurrency(data.metrics.totalPurchase)} accent="orange" icon={<FiShoppingBag />} footer={{ icon: <FiTrendingUp />, text: `${data.metrics.purchaseCount} transactions`, up: true }} />
          </div>

          {/* Secondary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SecondaryKPICard title="Suppliers" value={formatNumber(data.metrics.suppliers)} icon={<FiUserCheck />} accent="blue" />
            <SecondaryKPICard title="Customers" value={formatNumber(data.metrics.customers)} icon={<FiUsers />} accent="green" />
            <SecondaryKPICard title="Out of Stock" value={formatNumber(data.metrics.outOfStockItems || 3)} icon={<FiAlertTriangle />} accent="red" onClick={fetchOutOfStockItems}
              clickable={true}
            />
            <SecondaryKPICard title="Categories" value="24" icon={<FiBox />} accent="purple" />
          </div>

          {/* Charts and Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales & Purchase Trend */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales & Purchase Trends</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monthly performance overview</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Purchases</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span>Sales</span>
                  </div>
                </div>
              </div>
              <div className="h-80">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Stock Status */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Stock Status</h3>
              <div className="space-y-4">
                <StockStatusItem label="In Stock" value={data.metrics.totalItems - (data.metrics.lowStockItems || 0) - (data.metrics.outOfStockItems || 0) || 2096} total={data.metrics.totalItems || 2107} color="green" />
                <StockStatusItem label="Low Stock" value={data.metrics.lowStockItems || 8} total={data.metrics.totalItems || 2107} color="yellow" />
                <StockStatusItem label="Out of Stock" value={data.metrics.outOfStockItems || 3} total={data.metrics.totalItems || 2107} color="red" />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Critical Items</h4>
                <div className="space-y-2">
                  <CriticalItem name="Brake Pads - Honda City" stock={2} />
                  <CriticalItem name="Air Filter - Maruti Swift" stock={1} />
                  <CriticalItem name="Engine Oil 5W-30" stock={0} critical />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Recent Activity & Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
              </div>
              <div className="space-y-4">
                <TransactionItem type="sale" customer="Rajesh Motors" amount="₹12,450" time="2 hours ago" items="5 items" />
                <TransactionItem type="purchase" customer="AutoParts Supplier" amount="₹45,200" time="5 hours ago" items="25 items" />
                <TransactionItem type="sale" customer="City Service Center" amount="₹8,750" time="1 day ago" items="3 items" />
                <TransactionItem type="purchase" customer="Genuine Parts Co." amount="₹67,890" time="2 days ago" items="40 items" />
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Top Selling Items</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View Report</button>
              </div>
              <div className="space-y-4">
                <TopSellingItem name="Engine Oil 10W-40" category="Lubricants" sold={145} revenue="₹87,000" trend={12} />
                <TopSellingItem name="Brake Pads Set" category="Braking System" sold={89} revenue="₹67,200" trend={8} />
                <TopSellingItem name="Air Filter" category="Engine Parts" sold={76} revenue="₹22,800" trend={-3} />
                <TopSellingItem name="Spark Plugs Set" category="Ignition" sold={65} revenue="₹19,500" trend={15} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Low Stock Modal */}
      {showLowStockModal && (
        <LowStockModal items={lowStockItems}
          onClose={() => setShowLowStockModal(false)}
        />
      )}

      {/* Out of Stock Modal */}
      {showOutOfStockModal && (
        <OutOfStockModal items={outOfStockItems}
          onClose={() => setShowOutOfStockModal(false)}
        />
      )}
    </div>
  );
}

function KPICard({ title, value, accent, icon, footer }) {
  const accentMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    orange: "from-orange-50 to-orange-100 text-orange-700",
    rose: "from-rose-50 to-rose-100 text-rose-700",
    red: "from-red-50 to-red-100 text-red-700",
    pink: "from-pink-50 to-pink-100 text-pink-700",
    indigo: "from-indigo-50 to-indigo-100 text-indigo-700",
  };
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg bg-gradient-to-br ${accentMap[accent]} bg-opacity-20`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${accentMap[accent]}`}></div>
      {footer && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={footer.up ? "text-emerald-600" : "text-rose-600"}>
            {footer.icon}
          </span>
          <span className={footer.up ? "text-emerald-700" : "text-rose-700"}>
            {footer.text}
          </span>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function formatNumber(value) {
  const num = Number(value || 0);
  return num.toLocaleString();
}

function shortCurrency(value) {
  const num = Number(value || 0);
  if (Math.abs(num) >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(num) >= 1_00_000) return `₹${(num / 1_00_000).toFixed(1)}L`;
  if (Math.abs(num) >= 1_000) return `₹${(num / 1_000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
}

// New Components for Enhanced Dashboard
function QuickStat({ label, value, change, positive, critical, icon, onClick, clickable }) {
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200 ${clickable ? 'cursor-pointer hover:shadow-md hover:scale-105 hover:border-blue-300 dark:hover:border-blue-600' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${critical ? 'bg-red-100 text-red-600' : positive ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            {clickable && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to view details</p>
            )}
          </div>
        </div>
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${critical ? 'bg-red-100 text-red-700' : positive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          {change}
        </div>
      </div>
    </div>
  );
}

function SecondaryKPICard({ title, value, icon, accent, onClick, clickable }) {
  const accentColors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200 ${clickable ? 'cursor-pointer hover:shadow-md hover:scale-105 hover:border-blue-300 dark:hover:border-blue-600' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${accentColors[accent]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {clickable && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StockStatusItem({ label, value, total, color }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function CriticalItem({ name, stock, critical }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${critical ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
        <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${critical ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {stock} left
      </span>
    </div>
  );
}

function TransactionItem({ type, customer, amount, time, items }) {
  const isIncoming = type === 'sale';
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isIncoming ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
          {isIncoming ? <FiTrendingUp /> : <FiShoppingBag />}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{customer}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{items} • {time}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${isIncoming ? 'text-green-600' : 'text-blue-600'}`}>
          {isIncoming ? '+' : '-'}{amount}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{type}</p>
      </div>
    </div>
  );
}

function TopSellingItem({ name, category, sold, revenue, trend }) {
  const isPositive = trend > 0;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <FiBox />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{category}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{revenue}</p>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-500 dark:text-gray-400">{sold} sold</span>
          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{trend}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Low Stock Modal Component
function LowStockModal({ items, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <FiAlertTriangle className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Low Stock Items</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Items that need immediate attention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FiPackage className="text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">All Good!</h3>
              <p className="text-gray-500 dark:text-gray-400">No items are currently low in stock.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found <span className="font-semibold text-red-600">{items.length}</span> items with low stock
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Critical (≤ 5)</span>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full ml-4"></div>
                  <span>Low (6-10)</span>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300">
                <div className="col-span-1">Code</div>
                <div className="col-span-4">Item Name</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Brand</div>
                <div className="col-span-1 text-center">Stock</div>
                <div className="col-span-1 text-right">Cost</div>
                <div className="col-span-1 text-center">Status</div>
              </div>

              {/* Table Rows */}
              <div className="space-y-2">
                {items.map((item) => {
                  const stock = Number(item.curstock || 0);
                  const isCritical = stock <= 5;
                  return (
                    <div key={item.itemcode} className="grid grid-cols-12 gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="col-span-1 text-sm font-mono text-gray-600 dark:text-gray-400">
                        {item.itemcode}
                      </div>
                      <div className="col-span-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.itemname}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.model || 'N/A'}</p>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                        {item.groupname || 'N/A'}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                        {item.brandname || 'N/A'}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isCritical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {stock}
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        ₹{Number(item.cost || 0).toLocaleString()}
                      </div>
                      <div className="col-span-1 text-center">
                        <div className={`w-3 h-3 rounded-full mx-auto ${isCritical ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Items with stock ≤ 10 are considered low stock
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Navigate to items page with low stock filter
                window.location.href = '/items';
              }}
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <FiAlertTriangle className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Out of Stock Items</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Items that are completely out of stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FiPackage className="text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Great News!</h3>
              <p className="text-gray-500 dark:text-gray-400">No items are currently out of stock.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found <span className="font-semibold text-red-600">{items.length}</span> items that are out of stock
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                    Urgent Restocking Required
                  </div>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300">
                <div className="col-span-1">Code</div>
                <div className="col-span-4">Item Name</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Brand</div>
                <div className="col-span-1 text-center">Stock</div>
                <div className="col-span-1 text-right">Cost</div>
                <div className="col-span-1 text-center">Priority</div>
              </div>

              {/* Table Rows */}
              <div className="space-y-2">
                {items.map((item) => {
                  const cost = Number(item.cost || 0);
                  const isHighValue = cost > 1000; // High value items get higher priority
                  return (
                    <div key={item.itemcode} className="grid grid-cols-12 gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="col-span-1 text-sm font-mono text-gray-600 dark:text-gray-400">
                        {item.itemcode}
                      </div>
                      <div className="col-span-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.itemname}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.model || 'N/A'}</p>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                        {item.groupname || 'N/A'}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                        {item.brandname || 'N/A'}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          0
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        ₹{cost.toLocaleString()}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isHighValue ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                          {isHighValue ? 'High' : 'Medium'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Stats */}
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-red-600">{items.length}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">Total Items</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {items.filter(item => Number(item.cost || 0) > 1000).length}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400">High Priority</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      ₹{items.reduce((sum, item) => sum + Number(item.cost || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400">Total Value</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Items with 0 stock require immediate restocking
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Navigate to purchase page to create new purchase order
                window.location.href = '/purchase/new';
              }}
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
