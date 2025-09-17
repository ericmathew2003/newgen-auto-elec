import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { FiTrendingUp, FiShoppingBag, FiUsers, FiUserCheck, FiPercent } from "react-icons/fi";
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

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    metrics: {
      totalPurchase: 0,
      totalTax: 0,
      purchaseCount: 0,
      suppliers: 0,
      customers: 0,
    },
    charts: { purchaseMonthly: [] },
  });

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setError("");
        setLoading(true);
        const res = await axios.get("http://localhost:5000/api/dashboard/summary");
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
    const values = (data.charts?.purchaseMonthly || []).map((d) => Number(d.total || 0));
    return {
      labels,
      datasets: [
        {
          label: "Monthly Purchase Amount",
          data: values,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          tension: 0.35,
          pointRadius: 2.5,
          fill: true,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
        }
      },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: { callback: (v) => shortCurrency(v) }
      },
      x: {
        ticks: { autoSkip: true, maxTicksLimit: 12 },
        grid: { display: false }
      },
    },
  }), []);

  const lastMonthDelta = useMemo(() => {
    const series = data.charts?.purchaseMonthly || [];
    if (series.length < 2) return { pct: 0, up: true };
    const last = Number(series[series.length - 1].total || 0);
    const prev = Number(series[series.length - 2].total || 0);
    if (prev === 0) return { pct: 100, up: true };
    const pct = ((last - prev) / prev) * 100;
    return { pct: Math.round(pct), up: pct >= 0 };
  }, [data]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Key metrics overview and recent trends</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-700 border border-gray-200">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">Loading...</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KPICard title="Total Purchase" value={formatCurrency(data.metrics.totalPurchase)} accent="blue" icon={<FiShoppingBag />} footer={{ icon: <FiTrendingUp />, text: `${Math.abs(lastMonthDelta.pct)}% ${lastMonthDelta.up ? "up" : "down"} vs last mo.` , up: lastMonthDelta.up }} />
            <KPICard title="Total Tax" value={formatCurrency(data.metrics.totalTax)} accent="purple" icon={<FiPercent />} />
            <KPICard title="Purchases" value={formatNumber(data.metrics.purchaseCount)} accent="emerald" icon={<FiTrendingUp />} />
            <KPICard title="Suppliers" value={formatNumber(data.metrics.suppliers)} accent="orange" icon={<FiUserCheck />} />
            <KPICard title="Customers" value={formatNumber(data.metrics.customers)} accent="rose" icon={<FiUsers />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2 h-96">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Purchases Over Time</h3>
                <span className="text-xs text-gray-500">Monthly totals</span>
              </div>
              <div className="h-80">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Highlights</h3>
              <div className="space-y-3">
                <Highlight label="Avg. Monthly Purchase" value={formatCurrency(avg(data.charts?.purchaseMonthly || [], "total"))} />
                <Highlight label="Last Month" value={formatCurrency(lastValue(data.charts?.purchaseMonthly || [], "total"))} />
                <Highlight label="MoM Change" value={`${Math.abs(lastMonthDelta.pct)}% ${lastMonthDelta.up ? "increase" : "decrease"}`} up={lastMonthDelta.up} />
              </div>
            </div>
          </div>
        </>
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
  };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg bg-gradient-to-br ${accentMap[accent]} bg-opacity-20`}>{icon}</div>
        )}
      </div>
      <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${accentMap[accent]}`}></div>
      {footer && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={footer.up ? "text-emerald-600" : "text-rose-600"}>{footer.icon}</span>
          <span className={footer.up ? "text-emerald-700" : "text-rose-700"}>{footer.text}</span>
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

function Highlight({ label, value, up }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${up === undefined ? "text-gray-900" : up ? "text-emerald-700" : "text-rose-700"}`}>
        {value}
      </span>
    </div>
  );
}

function shortCurrency(value) {
  const num = Number(value || 0);
  if (Math.abs(num) >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(num) >= 1_00_000) return `₹${(num / 1_00_000).toFixed(1)}L`;
  if (Math.abs(num) >= 1_000) return `₹${(num / 1_000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
}

function avg(arr, key) {
  if (!arr.length) return 0;
  const sum = arr.reduce((s, x) => s + Number(x[key] || 0), 0);
  return sum / arr.length;
}

function lastValue(arr, key) {
  if (!arr.length) return 0;
  return Number(arr[arr.length - 1][key] || 0);
}
