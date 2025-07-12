# Backend URL Configuration Guide

This document lists all locations where backend URLs are configured in the application, making it easy to update them when needed.

## 🔧 Environment Variable Configuration

### Primary Method: Environment Variables
The recommended way to configure the backend URL is through environment variables:

**File: `.env` (create this file in the root directory)**
```bash
VITE_API_BASE_URL=https://your-backend-url.com
```

**Example:**
```bash
VITE_API_BASE_URL=http://localhost:8000
```

## 📂 Files Containing Backend URL References

### 1. Core Application Files

#### `src/lib/api.ts`
- **Line:** 1
- **Content:** Main API service configuration
- **Pattern:** `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'FALLBACK_URL';`
- **Usage:** Primary API service for all backend communications

#### `src/lib/services/interviewService.ts`
- **Line:** 3
- **Content:** Interview service configuration
- **Pattern:** `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'FALLBACK_URL';`
- **Usage:** Handles interview-specific API calls

### 2. Page Components

#### `src/pages/VideoInterview.tsx`
- **Lines:** 646, 851, 1052
- **Content:** Multiple API calls within interview functionality
- **Pattern:** `const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'FALLBACK_URL';`
- **Usage:** 
  - ElevenLabs signed URL endpoint
  - Session conversation updates
  - Interview completion with transcript

#### `src/pages/UploadProgress.tsx`
- **Line:** 102
- **Content:** Upload progress API calls
- **Pattern:** `const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'FALLBACK_URL';`
- **Usage:** Sends interview data and transcript for analysis

### 3. Component Files

#### `src/components/WebhookSetupGuide.tsx`
- **Line:** 15
- **Content:** Webhook URL configuration
- **Pattern:** `const backendUrl = import.meta.env.VITE_API_BASE_URL || 'FALLBACK_URL';`
- **Usage:** Displays webhook URLs for external service configuration

### 4. Configuration Examples

#### `azure-storage.config.example`
- **Line:** 12
- **Content:** Example configuration file
- **Pattern:** `VITE_API_BASE_URL=EXAMPLE_URL`
- **Usage:** Template for environment variable setup

## 🔄 How to Change Backend URLs

### Method 1: Environment Variables (Recommended)
1. Create or update `.env` file in the project root:
   ```bash
   VITE_API_BASE_URL=https://your-new-backend-url.com
   ```

2. Rebuild the application:
   ```bash
   npm run build
   ```

### Method 2: Update Fallback URLs (Not Recommended)
If you need to change the fallback URLs (when environment variable is not set):

1. Update the fallback URL in each file listed above
2. Replace `'http://localhost:8000'` with `'https://your-new-backend-url.com'`
3. Rebuild the application

## 📋 Current Backend Configuration

### Current Production Backend
```
URL: https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net
```

### Previously Used URLs
- `https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net` (Previous Azure deployment)
- `https://backendb2b.azurewebsites.net` (Previous Azure deployment)
- `https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net` (Previous Azure deployment)

## 🛠️ Related Configuration Files

### Documentation Files (Reference Only)
These files contain URL examples but don't affect the application:

- `FRONTEND_SETUP.md` - Contains setup instructions
- `ELEVENLABS_SETUP.md` - Contains ElevenLabs configuration examples
- `DEPLOYMENT.md` - Contains deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Contains deployment checklist
- `AZURE_CORS_SETUP.md` - Contains CORS configuration examples

### Docker Configuration Files
- `Dockerfile` - Line 43: Health check endpoint
- `docker-compose.yml` - Line 33: Health check endpoint
- `docker-compose-hub.yml` - Line 31: Health check endpoint

### Build Scripts
- `test-build.bat` - Lines 15-16: Contains example URLs for testing

## ⚠️ Important Notes

1. **Environment Variables Take Priority:** If `VITE_API_BASE_URL` is set, it will be used regardless of the fallback URL in the code.

2. **Rebuild Required:** After changing environment variables, you must rebuild the application for changes to take effect.

3. **CORS Configuration:** When changing backend URLs, ensure the new backend has proper CORS configuration to allow requests from your frontend domain.

4. **Health Checks:** Docker configurations include health check endpoints that may need to be updated if the backend structure changes.

5. **Webhook URLs:** External services (like ElevenLabs) may need to be reconfigured with new webhook URLs when the backend changes.

## 🔍 Search Commands for Finding URLs

To find all backend URL references in the future:

```bash
# Search for localhost references
grep -r "localhost:8000" .

# Search for environment variable usage
grep -r "VITE_API_BASE_URL" .

# Search for specific Azure URLs
grep -r "azurewebsites.net" .
```

## 📝 Changelog

### 2025-01-XX - Latest Update (MIGRATION TO AZURE)
- Updated all fallback URLs from `http://localhost:8000` to `https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net`
- Changed configuration from local development backend to Azure production backend
- Updated 6 core application files and 1 test script
- Docker health checks intentionally kept as localhost (correct behavior)
- Updated comprehensive documentation for backend URL management

### 2024-01-XX - Previous Update
- Added comprehensive documentation for backend URL management

---

**Last Updated:** [Current Date]
**Maintainer:** Development Team 