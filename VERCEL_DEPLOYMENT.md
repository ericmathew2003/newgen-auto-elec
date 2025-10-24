# 🚀 Vercel Deployment Guide for New Gen Auto

## 📋 Prerequisites

1. **GitHub Repository** ✅ (You already have this)
2. **Vercel Account** → Sign up at [vercel.com](https://vercel.com)
3. **Database Provider** → Choose one:
   - **Neon** (Recommended - Free PostgreSQL)
   - **Supabase** (Free PostgreSQL with extras)
   - **PlanetScale** (MySQL alternative)
   - **Railway** (PostgreSQL)

## 🗄️ Step 1: Set Up Database

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Create new project: "newgen-auto"
4. Copy connection string (looks like: `postgresql://user:pass@host/dbname`)
5. Run your database schema:
   ```sql
   -- Copy and paste your backend/database.sql content
   ```

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create new project: "newgen-auto"
3. Go to Settings → Database
4. Copy connection string
5. Use SQL Editor to run your schema

## 🚀 Step 2: Deploy to Vercel

### Method 1: Vercel Dashboard (Easiest)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `ericmathew2003/newgen-auto-elec`
4. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: Leave empty (monorepo)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/build`

### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project root
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: newgen-auto
# - Directory: ./
```

## ⚙️ Step 3: Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```env
NODE_ENV=production
DB_HOST=your-neon-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=true
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=https://your-app.vercel.app
```

### 🔑 How to Get Database Values:

**For Neon:**
- Connection string: `postgresql://user:pass@host:5432/dbname`
- Extract: `DB_HOST=host`, `DB_USER=user`, `DB_PASSWORD=pass`, `DB_NAME=dbname`

**For Supabase:**
- Go to Settings → Database → Connection string
- Use "URI" format and extract values

## 📁 Step 4: Project Structure (Already Done!)

Your project is already configured with:
- ✅ `vercel.json` - Vercel configuration
- ✅ `api/index.js` - Serverless API entry point
- ✅ Frontend build configuration
- ✅ Environment variable support

## 🔄 Step 5: Deploy and Test

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin main
   ```

2. **Vercel Auto-Deploy:**
   - Vercel automatically deploys on every push
   - Check deployment status in Vercel dashboard

3. **Test Your App:**
   - Frontend: `https://your-app.vercel.app`
   - API Health: `https://your-app.vercel.app/api/health`
   - Login: `https://your-app.vercel.app/login`

## 🛠️ Troubleshooting

### Common Issues:

1. **Build Fails:**
   ```bash
   # Check build logs in Vercel dashboard
   # Usually missing dependencies or environment variables
   ```

2. **Database Connection Error:**
   - Verify all DB environment variables
   - Ensure SSL is enabled (`DB_SSL=true`)
   - Check database is accessible from internet

3. **API Routes Not Working:**
   - Check `api/index.js` exists
   - Verify all route imports are correct
   - Check Vercel function logs

4. **CORS Issues:**
   - Should be resolved with same-domain deployment
   - If issues persist, check CORS configuration in `api/index.js`

### 🔍 Debugging:

**View Logs:**
- Vercel Dashboard → Your Project → Functions tab
- Click on any function to see logs

**Test API Endpoints:**
```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Test auth endpoint
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

## 🎯 Production Checklist

- [ ] Database created and schema imported
- [ ] All environment variables set in Vercel
- [ ] JWT_SECRET changed from default
- [ ] Database SSL enabled
- [ ] App deployed successfully
- [ ] Health check endpoint working
- [ ] Login functionality working
- [ ] All API endpoints responding
- [ ] Frontend loading correctly

## 🔄 Updates and Maintenance

### Automatic Deployments:
- Every `git push` to main branch triggers deployment
- Check deployment status in Vercel dashboard

### Manual Deployment:
```bash
vercel --prod
```

### Database Updates:
- Run migrations directly on your database provider
- Or use a database migration tool

## 💰 Cost Estimation

**Vercel (Free Tier):**
- ✅ 100GB bandwidth/month
- ✅ 100 serverless function executions/day
- ✅ Custom domains
- ✅ Automatic HTTPS

**Database (Free Tiers):**
- **Neon**: 0.5GB storage, 1 database
- **Supabase**: 500MB storage, 2 projects
- **Railway**: $5/month after trial

## 🆘 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connection
4. Check API endpoints individually

Your app will be live at: `https://your-app-name.vercel.app` 🎉