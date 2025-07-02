# Azure Static Web Apps Deployment Fix for Video Interview 404 Error

## Problem Identified
You're using **Azure Static Web Apps** (azurestaticapps.net), which requires a different configuration than regular Azure Web Apps. The previous `web.config` file doesn't work for Azure Static Web Apps.

## Solution Applied
Created the correct `staticwebapp.config.json` configuration file that Azure Static Web Apps uses for SPA routing.

## Files Added/Modified:

1. **`staticwebapp.config.json`** (root level)
2. **`public/staticwebapp.config.json`** (gets copied to build output)

These files configure the `navigationFallback` to redirect all non-asset requests to `index.html`, allowing React Router to handle the routing.

## Deployment Steps:

### Step 1: Verify Build
✅ **COMPLETED** - The build now includes `staticwebapp.config.json` in the `dist` folder

### Step 2: Deploy to Azure Static Web Apps

#### Option A: Automatic Deployment (GitHub Actions)
If you have GitHub Actions set up:
1. Commit and push the changes to your repository
2. The GitHub Action will automatically build and deploy
3. Wait for the deployment to complete

#### Option B: Manual Deployment
If deploying manually:
1. Deploy the entire contents of the `dist/` folder to Azure Static Web Apps
2. Make sure `staticwebapp.config.json` is included in the root of your deployment

### Step 3: Test the Fix
1. Generate a new interview link from your application
2. Click the link - it should now load the video interview page instead of showing 404
3. The URL should work: `https://your-app.azurestaticapps.net/video-interview?session=xyz`

## Configuration Details:

The `staticwebapp.config.json` includes:
- **navigationFallback**: Redirects all routes to index.html (except assets and API calls)
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **MIME types**: Proper content types for JSON files

## Excluded Paths:
The following paths are excluded from the fallback (served directly):
- `/images/*` - Image files
- `/css/*` - CSS files  
- `/js/*` - JavaScript files
- `/api/*` - API endpoints
- `/assets/*` - Build assets
- `/favicon.ico` - Favicon
- `/robots.txt` - Robots file

## How It Works:
1. User clicks interview link: `/video-interview?session=xyz`
2. Azure Static Web Apps serves `index.html` (via navigationFallback)
3. React app loads and React Router handles the `/video-interview` route
4. VideoInterview component extracts session ID from URL params
5. Component loads interview data and displays the interview interface

## Troubleshooting:
- Make sure the deployment includes `staticwebapp.config.json` in the root
- Check Azure Static Web Apps deployment logs for any errors
- Verify the build output contains all necessary files

## Next Steps:
After deployment, test the interview link generation and access to confirm the 404 error is resolved. 