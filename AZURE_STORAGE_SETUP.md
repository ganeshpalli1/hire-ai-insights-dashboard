# Azure Storage Setup Guide for Interview Recordings

This guide will help you set up Azure Blob Storage for storing interview recordings with automatic 30-day lifecycle management.

## 📋 Prerequisites

- Azure subscription
- Azure CLI installed (optional but recommended)
- Admin access to your Azure account

## 🚀 Step 1: Create Azure Storage Account

### Option A: Using Azure Portal

1. **Go to Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure account

2. **Create Storage Account**
   - Click "Create a resource"
   - Search for "Storage account"
   - Click "Create"

3. **Configure Basic Settings**
   ```
   Subscription: [Your subscription]
   Resource Group: [Create new or select existing]
   Storage Account Name: [unique name - e.g., "interviewrecordings2024"]
   Region: [Choose closest to your users]
   Performance: Standard
   Redundancy: LRS (Locally Redundant Storage) or GRS for backup
   ```

4. **Advanced Settings**
   ```
   Security:
   ✅ Enable secure transfer required
   ✅ Enable blob public access
   ✅ Enable storage account key access
   
   Data Lake Storage Gen2:
   ❌ Disable hierarchical namespace
   ```

5. **Create the Storage Account**
   - Review settings
   - Click "Create"
   - Wait for deployment to complete

### Option B: Using Azure CLI

```bash
# Set variables
RESOURCE_GROUP="interview-platform-rg"
STORAGE_ACCOUNT="interviewrecordings2024"
LOCATION="eastus"

# Create resource group (if needed)
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot \
  --https-only true \
  --allow-blob-public-access true
```

## 🗂️ Step 2: Create Container for Recordings

### Using Azure Portal

1. **Navigate to Storage Account**
   - Go to your storage account in Azure Portal
   - Click on "Containers" in the left menu

2. **Create New Container**
   - Click "+ Container"
   - Container name: `interview-recordings`
   - Public access level: `Blob` (allows direct URL access)
   - Click "Create"

### Using Azure CLI

```bash
# Create container
az storage container create \
  --name interview-recordings \
  --account-name $STORAGE_ACCOUNT \
  --public-access blob
```

## 🔐 Step 3: Configure Access and Security

### Generate SAS Token (Shared Access Signature)

1. **In Azure Portal**
   - Go to your storage account
   - Click "Shared access signature" in the left menu

2. **Configure SAS Token**
   ```
   Allowed services: ✅ Blob
   Allowed resource types: ✅ Service, ✅ Container, ✅ Object
   Allowed permissions: ✅ Read, ✅ Write, ✅ Delete, ✅ List, ✅ Add, ✅ Create
   
   Start time: [Current date/time]
   Expiry time: [1 year from now]
   Allowed protocols: HTTPS only
   
   Advanced options:
   Signing key: key1
   ```

3. **Generate SAS Token**
   - Click "Generate SAS and connection string"
   - Copy the **SAS token** (starts with `?sv=`)
   - Save this securely - you'll need it for configuration

### Using Azure CLI

```bash
# Generate SAS token (valid for 1 year)
EXPIRY_DATE=$(date -d '+1 year' '+%Y-%m-%dT%H:%MZ')

az storage account generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --services b \
  --resource-types sco \
  --permissions rwdlac \
  --expiry $EXPIRY_DATE \
  --https-only \
  --output tsv
```

## ⏰ Step 4: Set Up 30-Day Lifecycle Management

### Using Azure Portal

1. **Navigate to Lifecycle Management**
   - Go to your storage account
   - Click "Lifecycle management" under "Data management"

2. **Add New Rule**
   - Click "+ Add a rule"
   - Rule name: `delete-old-recordings`
   - Rule scope: `Limit blobs with filters`

3. **Configure Rule Details**
   ```
   Blob type: Block blobs
   
   Filters:
   - Blob prefix: interview-recordings/
   
   Base blobs:
   ✅ Delete blob
   Days after last modification: 30
   ```

4. **Save the Rule**
   - Review settings
   - Click "Add"

### Using Azure CLI

```bash
# Create lifecycle policy JSON
cat > lifecycle-policy.json << EOF
{
  "rules": [
    {
      "enabled": true,
      "name": "delete-old-recordings",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["interview-recordings/"]
        },
        "actions": {
          "baseBlob": {
            "delete": {
              "daysAfterModificationGreaterThan": 30
            }
          }
        }
      }
    }
  ]
}
EOF

# Apply lifecycle policy
az storage account management-policy create \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --policy @lifecycle-policy.json
```

## 🔧 Step 5: Configure CORS (Cross-Origin Resource Sharing)

### Using Azure Portal

1. **Navigate to CORS Settings**
   - Go to your storage account
   - Click "Resource sharing (CORS)" under "Settings"

2. **Configure Blob Service CORS**
   ```
   Allowed origins: * (or your specific domain)
   Allowed methods: GET, PUT, POST, DELETE, HEAD, OPTIONS
   Allowed headers: *
   Exposed headers: *
   Max age: 86400
   ```

3. **Save CORS Settings**

### Using Azure CLI

```bash
az storage cors add \
  --account-name $STORAGE_ACCOUNT \
  --services b \
  --methods GET PUT POST DELETE HEAD OPTIONS \
  --origins "*" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 86400
```

## 🌐 Step 6: Environment Configuration

### Create Environment Variables

Create a `.env` file in your project root:

```bash
# Azure Storage Configuration
VITE_AZURE_STORAGE_ACCOUNT=your-storage-account-name
VITE_AZURE_STORAGE_SAS_TOKEN=your-sas-token-without-question-mark

# Example:
# VITE_AZURE_STORAGE_ACCOUNT=interviewrecordings2024
# VITE_AZURE_STORAGE_SAS_TOKEN=sv=2023-01-03&ss=b&srt=sco&sp=rwdlacupx&se=2025-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=YourSignatureHere
```

### Update Package Dependencies

Add Azure Storage Blob SDK to your project:

```bash
npm install @azure/storage-blob
```

## 🧪 Step 7: Test Your Setup

### Verify Storage Access

```javascript
// Test file: test-azure-storage.js
import { azureBlobService } from './src/lib/services/azureBlobService';

async function testStorage() {
  console.log('Testing Azure Storage setup...');
  
  // Initialize service
  const initialized = await azureBlobService.initialize();
  if (!initialized) {
    console.error('❌ Failed to initialize Azure Storage');
    return;
  }
  
  console.log('✅ Azure Storage initialized successfully');
  
  // Get container stats
  const stats = await azureBlobService.getContainerStats();
  console.log('📊 Container stats:', stats);
  
  console.log('🎉 Setup test completed successfully!');
}

testStorage().catch(console.error);
```

Run the test:

```bash
node test-azure-storage.js
```

## 📊 Step 8: Monitor Storage Usage

### Set Up Alerts

1. **Create Budget Alert**
   - Go to "Cost Management + Billing"
   - Set up budget alerts for storage costs

2. **Monitor Storage Metrics**
   - Use Azure Monitor to track:
     - Storage capacity used
     - Number of requests
     - Data egress costs

### View Lifecycle Management Logs

```bash
# View lifecycle management execution
az storage account management-policy show \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP
```

## 🔒 Step 9: Security Best Practices

### Recommended Security Settings

1. **Network Access**
   - Consider restricting to specific IP ranges
   - Use private endpoints for production

2. **Access Keys**
   - Rotate storage keys regularly
   - Use Azure Key Vault for key management

3. **Monitoring**
   - Enable diagnostic logging
   - Set up alerts for unusual access patterns

### Security Configuration Example

```bash
# Enable diagnostic logging
az storage logging update \
  --account-name $STORAGE_ACCOUNT \
  --services b \
  --log rwd \
  --retention 90

# Enable metrics
az storage metrics update \
  --account-name $STORAGE_ACCOUNT \
  --services b \
  --api true \
  --hour true \
  --minute false \
  --retention 90
```

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   ```
   Error: Access to fetch has been blocked by CORS policy
   Solution: Verify CORS settings allow your domain and required methods
   ```

2. **SAS Token Issues**
   ```
   Error: Server failed to authenticate the request
   Solution: Check SAS token expiry and permissions
   ```

3. **Container Not Found**
   ```
   Error: The specified container does not exist
   Solution: Verify container name and public access level
   ```

### Debug Commands

```bash
# Test SAS token
az storage blob list \
  --container-name interview-recordings \
  --account-name $STORAGE_ACCOUNT \
  --sas-token $SAS_TOKEN

# Check lifecycle policy
az storage account management-policy show \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP
```

## 💰 Cost Estimation

### Typical Costs (US East region)

- **Storage**: ~$0.02 per GB per month
- **Transactions**: ~$0.004 per 10,000 requests
- **Data Transfer**: First 100GB free, then ~$0.087 per GB

### Example Monthly Cost for 100 interviews:
```
- Storage (100 interviews × 500MB × 30 days): ~$1.50
- Upload transactions: ~$0.01
- Download transactions: ~$0.05
- Total: ~$1.56 per month
```

## 📞 Support

### Getting Help

1. **Azure Support**: [Azure Support Portal](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
2. **Documentation**: [Azure Blob Storage Docs](https://docs.microsoft.com/azure/storage/blobs/)
3. **Community**: [Stack Overflow - Azure Storage](https://stackoverflow.com/questions/tagged/azure-storage)

### Emergency Recovery

```bash
# List all blobs (in case of accidental deletion)
az storage blob list \
  --container-name interview-recordings \
  --account-name $STORAGE_ACCOUNT \
  --include-metadata \
  --output table

# Recover deleted blobs (if soft delete is enabled)
az storage blob undelete \
  --container-name interview-recordings \
  --name [blob-name] \
  --account-name $STORAGE_ACCOUNT
```

---

## ✅ Checklist

- [ ] Azure Storage Account created
- [ ] Container `interview-recordings` created with blob access
- [ ] SAS token generated and configured
- [ ] 30-day lifecycle management rule set up
- [ ] CORS configured for your domain
- [ ] Environment variables set
- [ ] Azure Storage SDK installed
- [ ] Storage access tested
- [ ] Budget alerts configured
- [ ] Security settings reviewed

Your Azure Storage is now ready for interview recordings! 🎉 