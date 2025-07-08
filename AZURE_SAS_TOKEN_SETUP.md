# Azure SAS Token Generation Guide

## Step 1: Navigate to Your Container
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: Storage Accounts → `pdf1` → Containers → `interviewvideo`

## Step 2: Generate SAS Token
1. Click on your container `interviewvideo`
2. In the left menu, click **Shared access tokens**
3. Configure the following settings:

### Permissions (IMPORTANT - Select ALL of these):
- [x] Read
- [x] Add
- [x] Create
- [x] Write
- [x] Delete
- [x] List
- [x] Immutable storage

### Start and Expiry:
- Start: Current date/time
- Expiry: Set to 1 year from now (or your preferred duration)

### Allowed IP addresses:
- Leave blank (allows all IPs)

### Allowed protocols:
- HTTPS only

## Step 3: Generate SAS Token and URL
1. Click **Generate SAS token and URL**
2. You'll see two values:
   - **Blob SAS token**: The token part only
   - **Blob SAS URL**: The full URL including the token

## Step 4: Copy the SAS Token
Copy the **Blob SAS token** (NOT the full URL). It should look like:
```
sp=racwdli&st=2025-01-06T08:49:07Z&se=2026-01-12T16:49:07Z&sv=2024-11-04&sr=c&sig=YOUR_SIGNATURE_HERE
```

## Important Notes:
- Make sure ALL permissions are checked (Read, Add, Create, Write, Delete, List)
- The token should have `sp=racwdli` (all permissions)
- Save this token securely - you cannot retrieve it again after leaving the page 