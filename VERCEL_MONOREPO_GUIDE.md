# Deploying Frontend + Backend to Vercel (Recommended)

Since the "Scan" feature requires a server to send emails and create Excel files, we must deploy the backend too. The good news is Vercel supports this natively for free!

Your project is **already configured** for this. You just need to update the Vercel Project Settings.

## 1. Vercel Project Settings (Crucial)

Go to your Vercel Project > **Settings** > **General** and configure exactly like this:

| Setting | Value | Why? |
| :--- | :--- | :--- |
| **Root Directory** | `.` (The root folder, NOT `client`) | Allows Vercel to see both `api` and `client` folders. |
| **Framework Preset** | **Other** (Do NOT choose Vite) | We are building a custom monorepo. |
| **Build Command** | `cd client && npm install && npm run build` | Builds the React app inside the client folder. |
| **Output Directory** | `client/dist` | Tells Vercel where the React build files are. |

## 2. Environment Variables

Go to **Settings** > **Environment Variables** and add:

- `EMAIL_USER`: (Your Gmail)
- `GOOGLE_CLIENT_ID`: (From Google Cloud)
- `GOOGLE_CLIENT_SECRET`: (From Google Cloud)
- `GOOGLE_REFRESH_TOKEN`: (From Google OAuth)

> **Note**: `VITE_API_URL` is **NOT** needed for this setup. The app will automatically use `/api/submit` which works perfectly on the same domain.

## 3. Deploy

1. Go to the **Deployments** tab.
2. Click the three dots (`...`) next to the latest commit and select **Redeploy**.
3. Ensure "Use existing Build Cache" is **unchecked** if possible, to force a fresh build.

## 4. Verification

1. **Check Backend**: Visit `https://your-app.vercel.app/api/health`.
   - It should say `{"status":"Ok"}`.
   - If it says 404, check the "Root Directory" setting again.
2. **Check Frontend**: Visit `https://your-app.vercel.app/`.
   - The site should load.
3. **Test Scan**:
   - Enter a Punch Number.
   - Scan a code.
   - It should say "Scan sent successfully!"

## 5. Troubleshooting "No Output Directory"

If you get "No Output Directory":
1. Double check your **Build Command** runs successfully locally.
2. Double check your **Output Directory** is exactly `client/dist`.
3. In Vercel Settings, ensure you overrode the default "Public" directory if it asked (usually not needed).
