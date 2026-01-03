# Vercel Deployment Guide

Your project is now configured for Vercel with a React frontend and Node.js Serverless Backend.

## 1. Project Structure
- **/api**: Contains your backend serverless functions (`index.js`). This replaces `server/`.
- **/client**: Contains your React + Vite frontend.
- **vercel.json**: Configures routing so calls to `/api/*` go to the backend, and everything else goes to the frontend.

## 2. Environment Variables
You MUST set the following Environment Variables in your Vercel Project Settings (under **Settings > Environment Variables**):

- `EMAIL_USER` (Your Gmail address)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

> **Note**: Without these, the email functionality will fail, but the scan will still be recorded in the response.

## 3. Vercel Configuration Settings
Ensure your Vercel Project is configured as follows:

- **Root Directory**: `.` (The root of your repo, NOT `client`)
- **Framework Preset**: `Vite` (or `Other` if it doesn't auto-detect correctly with root)
- **Build Command**: `cd client && npm install && npm run build` (This is defined in your root `package.json`)
- **Output Directory**: `client/dist` (This is where Vite builds the frontend)

## 4. Verification
1. Push your code to GitHub/GitLab.
2. Vercel should automatically deploy.
3. Open your live URL.
4. Go to `https://<your-app>.vercel.app/api/health` to verify the backend is running (should return `{"status":"Ok", ...}`).
5. Test the Scanner.

## 5. Troubleshooting
- If you see **404** for API calls: Check `vercel.json` rewrites and ensure the `api` folder is present in your repository.
- If you see **500** for API calls: Check Vercel Logs (Functions tab). Usually means missing Environment Variables or a crash in `nodemailer`.
