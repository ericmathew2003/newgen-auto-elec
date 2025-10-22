const express=require("express");
const app=express();
const cors=require("cors");
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

// middleware
app.use(cors());
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

app.listen(5000, ()=>{
    console.log("Server has started on port 5000");
});