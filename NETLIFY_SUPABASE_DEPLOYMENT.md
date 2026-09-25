# Step-by-Step Deployment Guide: Netlify + Supabase

This guide walks you through deploying your portfolio to **Netlify** with a **Supabase** backend.

---

## Part 1: Supabase Setup (5 Minutes)

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **"New Project"**.
3. Choose a project name (e.g. `ashi-portfolio`), create a database password, and select a region close to your target audience.
4. Wait 1–2 minutes while Supabase provisions your PostgreSQL database.

### 2. Run the Database Schema & Seed Data
1. In your Supabase dashboard, navigate to **SQL Editor** (the terminal/script icon on the left sidebar).
2. Click **"New query"**.
3. Open the generated file [`supabase-schema.sql`](file:///c:/Users/ryshi/Downloads/Ashi/supabase-schema.sql) in your workspace, copy its contents, paste them into the SQL Editor, and click **"Run"**.
   - This creates the `projects`, `categories`, and `site` tables, sets Row Level Security (RLS), and configures the `portfolio-media` storage bucket policies.
4. Next, create another query, open [`supabase-seed.sql`](file:///c:/Users/ryshi/Downloads/Ashi/supabase-seed.sql), copy its contents, paste them into the SQL Editor, and click **"Run"**.
   - This populates your Supabase database with all your existing portfolio items, scatter cards, tags, and categories.

### 3. Create / Verify the Storage Bucket
1. Go to **Storage** in the left sidebar.
2. Confirm there is a bucket named `portfolio-media`.
3. If not already present, click **"New bucket"**, enter `portfolio-media`, and ensure **"Public bucket"** is enabled.

### 4. Copy Your API Keys
1. Go to **Project Settings** (gear icon) -> **API**.
2. Note down:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **anon / public key** (`eyJhbGciOi...`)

### 5. Update Your Frontend Config
Open [`scripts/supabase-config.js`](file:///c:/Users/ryshi/Downloads/Ashi/scripts/supabase-config.js) and replace the placeholders:
```javascript
global.SUPABASE_CONFIG = {
  url: 'https://YOUR_ACTUAL_PROJECT_ID.supabase.co',
  anonKey: 'YOUR_ACTUAL_SUPABASE_ANON_KEY',
  storageBucket: 'portfolio-media'
};
```

---

## Part 2: Deploying to Netlify (3 Minutes)

### Option A: Deploy via GitHub (Recommended for Continuous Deployment)
1. Push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Configure Supabase and Netlify deployment"
   git push origin main
   ```
2. Log into [https://app.netlify.com](https://app.netlify.com).
3. Click **"Add new site"** -> **"Import an existing project"** -> **GitHub**.
4. Select your repository (`portfolio-AETHER` or `Ashi`).
5. Netlify will automatically detect [`netlify.toml`](file:///c:/Users/ryshi/Downloads/Ashi/netlify.toml):
   - **Publish directory**: `.` (Root directory)
   - **Build command**: *(leave empty)*
6. Click **"Deploy site"**.

### Option B: Deploy via Netlify CLI (Direct from Terminal)
If you don't want to use git right now, you can deploy directly:
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=.
```

---

## Part 3: Verification & Live Site Checklist

1. **Homepage & WebGL:**
   - Verify that hero scatter cards, wireframe centerpiece, and works cards render smoothly.
   - The frontend automatically queries Supabase directly on static hosting without needing Node.js or SQLite running.
2. **Gallery:**
   - Visit `https://your-site.netlify.app/gallery` to confirm project filtering, badges, and detail modal.
3. **Custom Domain (Optional):**
   - In Netlify, go to **Domain management** -> **Add a custom domain** if you wish to link your own URL.
