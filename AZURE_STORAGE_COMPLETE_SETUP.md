# Complete Azure Storage Setup Guide

Follow these steps **in order** to properly configure Azure Storage for your interview recording application.

## Prerequisites
- Access to Azure Portal: https://portal.azure.com
- Storage Account: `pdf1`
- Container: `interviewvideo`

## Step 1: Configure CORS in Azure Portal

1. Navigate to your Storage Account:
   - Go to [Azure Portal](https://portal.azure.com)
   - Search for and select your storage account: `pdf1`

2. Configure CORS:
   - In the left menu, under **Settings**, click **Resource sharing (CORS)**
   - Click on the **Blob service** tab
   - Click **+ Add** to add a new CORS rule
   - Enter the following settings:
     ```
     Allowed origins: *
     Allowed methods: GET,PUT,POST,DELETE,OPTIONS
     Allowed headers: *
     Exposed headers: *
     Max age (seconds): 86400
     ```
   - Click **Save** at the top

   > **Note**: For production, replace `*` in Allowed origins with your specific domain(s)

3. Wait 2-3 minutes for CORS changes to propagate.

## Step 2: Generate a New SAS Token

1. Navigate to your container:
   - In your storage account `pdf1`, click **Containers** in the left menu
   - Click on the `interviewvideo` container

2. Generate SAS token:
   - In the left menu of the container, click **Shared access tokens**
   - Configure the following:

   **Signing method**: Account key

   **Permissions** (CHECK ALL):
   - ☑ Read
   - ☑ Add  
   - ☑ Create
   - ☑ Write
   - ☑ Delete
   - ☑ List
   - ☑ Immutable storage

   **Start**: Leave as current date/time
   **Expiry**: Set to 1 year from now

   **Allowed IP addresses**: Leave blank
   **Allowed protocols**: HTTPS only

3. Click **Generate SAS token and URL**

4. **IMPORTANT**: Copy the **Blob SAS token** (not the full URL)
   It should look like:
   ```
   sp=racwdli&st=2025-01-06T...&se=2026-01-06T...&sv=2024-11-04&sr=c&sig=...
   ```

## Step 3: Update Your Application Code

1. Open the file: `src/lib/services/azureBlobService.ts`

2. Find line 45 where the SAS token is defined:
   ```typescript
   private readonly sasToken = 'YOUR_OLD_SAS_TOKEN';
   ```

3. Replace it with your new SAS token:
   ```typescript
   private readonly sasToken = 'YOUR_NEW_SAS_TOKEN_HERE';
   ```

## Step 4: Verify the Setup

1. Save the file
2. Restart your development server
3. Open your browser's Developer Console (F12)
4. Navigate to the Video Interview page
5. Look for these success messages in the console:
   ```
   ✅ Container 'interviewvideo' is accessible
   ✅ Azure Blob Storage initialized successfully
   ```

## Troubleshooting

### Still getting 403 errors?
1. Double-check that ALL permissions are selected when generating the SAS token
2. Ensure the SAS token hasn't expired
3. Verify the container name is exactly `interviewvideo`
4. Check that CORS is configured for Blob service (not Table or Queue)

### Getting 404 errors?
1. Ensure the container `interviewvideo` exists
2. Check that the container name is spelled correctly

### CORS errors in browser?
1. Wait a few more minutes for CORS to propagate
2. Try clearing your browser cache
3. Ensure you saved the CORS configuration in Azure Portal

## Test Upload

Once everything is configured:
1. Start an interview
2. Allow screen sharing when prompted
3. End the interview
4. Check the console for:
   ```
   ✅ Upload completed successfully
   ```

The recording should now be uploaded to your Azure Storage container! 