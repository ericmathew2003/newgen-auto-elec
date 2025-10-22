// Sample data for development and testing
export const sampleDashboardData = {
  totalItems: 1250,
  totalSuppliers: 45,
  totalPurchases: 89,
  totalReturns: 12,
  lowStockItems: 8,
  monthlyPurchases: 245000,
  monthlyReturns: 15000,
  recentTransactions: [
    {
      date: '2024-12-15',
      amount: '25,000',
      party: 'ABC Suppliers Ltd',
      type: 'Purchase'
    },
    {
      date: '2024-12-14',
      amount: '18,500',
      party: 'XYZ Electronics',
      type: 'Purchase'
    },
    {
      date: '2024-12-13',
      amount: '32,000',
      party: 'Tech Solutions Inc',
      type: 'Purchase'
    },
    {
      date: '2024-12-12',
      amount: '12,500',
      party: 'Global Parts Co',
      type: 'Return'
    },
    {
      date: '2024-12-11',
      amount: '45,000',
      party: 'Premium Supplies',
      type: 'Purchase'
    }
  ],
  stockAlerts: [
    {
      itemName: 'Laptop Battery - Dell 5520',
      currentStock: 3
    },
    {
      itemName: 'USB Cable Type-C',
      currentStock: 5
    },
    {
      itemName: 'Wireless Mouse - Logitech',
      currentStock: 2
    },
    {
      itemName: 'HDMI Cable 2m',
      currentStock: 7
    },
    {
      itemName: 'Power Adapter 65W',
      currentStock: 4
    }
  ],
  topItems: [
    {
      itemName: 'MacBook Pro 16"',
      stock: 25,
      cost: 180000,
      stockValue: 4500000
    },
    {
      itemName: 'iPhone 15 Pro',
      stock: 50,
      cost: 120000,
      stockValue: 6000000
    },
    {
      itemName: 'Samsung Galaxy S24',
      stock: 35,
      cost: 85000,
      stockValue: 2975000
    }
  ]
};

export const sampleTrends = {
  purchaseTrends: [
    { month: 7, year: 2024, transactionCount: 45, totalAmount: 450000 },
    { month: 8, year: 2024, transactionCount: 52, totalAmount: 520000 },
    { month: 9, year: 2024, transactionCount: 48, totalAmount: 480000 },
    { month: 10, year: 2024, transactionCount: 55, totalAmount: 550000 },
    { month: 11, year: 2024, transactionCount: 60, totalAmount: 600000 },
    { month: 12, year: 2024, transactionCount: 58, totalAmount: 580000 }
  ],
  inventoryTrends: [
    { month: 7, year: 2024, type: 'IN', movementCount: 120 },
    { month: 7, year: 2024, type: 'OUT', movementCount: 95 },
    { month: 8, year: 2024, type: 'IN', movementCount: 135 },
    { month: 8, year: 2024, type: 'OUT', movementCount: 110 },
    { month: 9, year: 2024, type: 'IN', movementCount: 125 },
    { month: 9, year: 2024, type: 'OUT', movementCount: 105 }
  ]
};

export const samplePerformance = {
  inventoryTurnover: '4.2',
  growthRate: '15.3',
  currentMonthRevenue: 580000
};