# Azure Storage CORS Configuration Guide

## Step 1: Access Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Storage Account: `pdf1`

## Step 2: Configure CORS Settings
1. In the Storage Account menu, find **Resource sharing (CORS)** under **Settings**
2. Select the **Blob service** tab
3. Add the following CORS rules:

### Development Environment
```
Allowed origins: http://localhost:5173, http://localhost:5174, http://localhost:3000
Allowed methods: GET, PUT, POST, DELETE, OPTIONS
Allowed headers: *
Exposed headers: *
Max age (seconds): 86400
```

### Production Environment (if deployed)
```
Allowed origins: https://yourdomain.com
Allowed methods: GET, PUT, POST, DELETE, OPTIONS
Allowed headers: *
Exposed headers: *
Max age (seconds): 86400
```

## Step 3: Save CORS Settings
Click **Save** at the top of the CORS configuration page.

## Important Notes:
- CORS changes may take a few minutes to propagate
- Using `*` for allowed origins is NOT recommended for production
- Always use specific domains in production for security 