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
const accountingPeriodRoutes = require("./routes/accountingPeriodRoutes");
const salesRoutes = require("./routes/salesRoutes");
const purchaseReturnRoutes = require("./routes/purchaseReturnRoutes");
const companyRoutes = require("./routes/companyRoutes");
const dashboardRoutes = require("./routes/dashboard");

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
app.use("/api/sales", salesRoutes);
app.use("/api/purchase-return", purchaseReturnRoutes);
app.use("/api/accounting-periods", accountingPeriodRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=>{
    console.log(`Server has started on port ${PORT}`);
});