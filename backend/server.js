const express=require("express");
const app=express();
const cors=require("cors");
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const brandRoutes = require("./routes/brandRoutes");
const groupRoutes = require("./routes/groupRoutes");
const makeRoutes = require("./routes/makeRoutes");
const itemRoutes = require("./routes/itemRoutes");
const partyRoutes = require("./routes/partyRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const accountingPeriodRoutes = require("./routes/accountingPeriodRoutes");
const salesRoutes = require("./routes/salesRoutes");
const purchaseReturnRoutes = require("./routes/purchaseReturnRoutes");
const salesReturnRoutes = require("./routes/salesReturnRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const companyRoutes = require("./routes/companyRoutes");
const dashboardRoutes = require("./routes/dashboard");
const accountRoutes = require("./routes/accountRoutes");
const accountGroupRoutes = require("./routes/accountGroupRoutes");
const coaRoutes = require("./routes/coaRoutes");
const journalRoutes = require("./routes/journalRoutes");
const transactionMappingRoutes = require("./routes/transactionMappingRoutes");
const natureRoutes = require("./routes/natureRoutes");
const valueSourceRoutes = require("./routes/valueSourceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const mlRoutes = require("./routes/mlRoutes");

// Conditionally load ML Python routes only if explicitly enabled
// Set ENABLE_ML_PYTHON=true in .env to enable Python ML routes
let mlPythonRoutes = null;
if (process.env.ENABLE_ML_PYTHON === 'true') {
  try {
    mlPythonRoutes = require("./routes/mlRoutes_python");
    console.log('✅ ML Python routes loaded');
  } catch (e) {
    console.log('⚠️  ML Python routes failed to load:', e.message);
    console.log('   Make sure axios is installed: npm install axios');
  }
} else {
  console.log('ℹ️  ML Python routes disabled (set ENABLE_ML_PYTHON=true to enable)');
}

const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const rolePermissionRoutes = require("./routes/rolePermissionRoutes");
const userRoleRoutes = require("./routes/userRoleRoutes");

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
      process.env.VERCEL_FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// middleware
app.use(cors(corsOptions));
app.use(express.json());

//Routes
app.use('/api/auth', authRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/makes", makeRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/purchase-return", purchaseReturnRoutes);
app.use("/api/sales-return", salesReturnRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/accounting-periods", accountingPeriodRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/acc-mas-account", accountRoutes);
app.use("/api/account-groups", accountGroupRoutes);
app.use("/api/coa", coaRoutes);
app.use("/api/accounting/journals", journalRoutes);
app.use("/api/transaction-mapping", transactionMappingRoutes);
app.use("/api/account-natures", natureRoutes);
app.use("/api/value-sources", valueSourceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ml", mlRoutes);

// Only register ML Python routes if axios is available
if (mlPythonRoutes) {
  app.use("/api/ml", mlPythonRoutes);
}

app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/role-permissions", rolePermissionRoutes);
app.use("/api/user-roles", userRoleRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=>{
    console.log(`Server has started on port ${PORT}`);
});