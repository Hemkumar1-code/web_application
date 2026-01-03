# Vercel Deployment Guide (Frontend Only)

This guide explains how to deploy only the React (Vite) frontend to Vercel. We will ignore the backend folder for this deployment.

## 1. Prepare your Project Checklist
- [x] **API Configuration**: The App is now updated to use `VITE_API_URL`.
- [x] **Configuration File**: `client/vercel.json` is updated for proper routing.
- [x] **Build Check**: `npm run build` inside `client` works successfully.

## 2. Deploy to Vercel (Step-by-Step)

### Option A: Via Vercel Dashboard (Recommended for Beginners)
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** -> **"Project"**.
3. Import your Git repository (`web_application` or similar).
4. **Configure Project Settings** (Crucial Step):
   - **Framework Preset**: Select **Vite**.
   - **Root Directory**: Click "Edit" and select the **`client`** folder.
     - *Why?* This ensures Vercel ignores the root `vercel.json` and only builds your frontend.
   - **Build Command**: Leave default (`vite build` or `npm run build`).
   - **Output Directory**: Leave default (`dist`).
5. **Environment Variables**:
   - Add a new variable named `VITE_API_URL`.
   - Set the value to your live Backend URL (e.g., `https://my-backend.onrender.com` or another Vercel app).
   - *Note*: You can leave this blank initially, but scanning will log errors until connected to a real backend.
6. Click **Deploy**.

### Option B: Via Vercel CLI
If you prefer the command line:
1. Open your terminal in VS Code.
2. Navigate to the client folder:
   ```bash
   cd client
   ```
3. Run the deploy command:
   ```bash
   npx vercel .
   ```
4. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? (Select your team/user)
   - Link to existing project? **N** (Create a new one for clarity)
   - Project Name: `web-application-client`
   - In which directory is your code located? **.** (Keep default as dot)
   - Want to modify these settings? **N**
5. Wait for deployment to finish.

## 3. Common Errors & Solutions

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **"No Output Directory found"** | Vercel built the root or couldn't find `dist`. | Ensure **Root Directory** is set to `client` in global settings. |
| **"404: NOT_FOUND"** or **Page Broken on Refresh** | SPA Routing issue. | We fixed this by adding `client/vercel.json` with rewrite rules. |
| **"Deployment Not Found"** | Visiting a bad URL or failed build. | Check your Vercel Dashboard for the *new* valid URL. |
| **Scanner doesn't work** | API URL is pointing to localhost. | Set `VITE_API_URL` environment variable to your production backend. |

## 4. Final Verification
1. Click the domain provided by Vercel (e.g., `https://web-application-client.vercel.app`).
2. The site should load without errors.
3. Open Developer Tools (F12) -> Console.
4. Try to scan. It should log "Sending scan to [Your API URL]...".
