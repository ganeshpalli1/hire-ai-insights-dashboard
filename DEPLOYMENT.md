# Deployment Configuration

## Backend Configuration

The application is configured to use the Azure Web App backend:

**Backend URL**: `https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net`

## Frontend Configuration

The frontend automatically detects the backend URL using the following priority:

1. **Environment Variable**: `VITE_API_BASE_URL` (if set)
2. **Fallback**: Azure Web App URL (configured in code)

### Environment Variable Setup (Optional)

To override the default backend URL, create a `.env.local` file in the root directory:

```bash
# Frontend Environment Configuration
VITE_API_BASE_URL=https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net
```

### Updated Files

The following files have been updated to use the Azure backend:

- `src/lib/api.ts` - Main API service
- `src/lib/services/interviewService.ts` - Interview service

## Building for Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker Hub

The container is available on Docker Hub:
- **Repository**: `ganeshpalli779/hire-ai-insights-dashboard:latest`
- **Pull Command**: `docker pull ganeshpalli779/hire-ai-insights-dashboard:latest`

## Azure Web App

The backend is deployed on Azure Web App with the following configuration:
- **URL**: https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net
- **Health Check**: https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net/api/health
- **API Documentation**: https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net/docs

## Testing the Configuration

To test if the frontend can connect to the Azure backend:

1. **Health Check**: Visit the backend health endpoint
2. **API Documentation**: Check the Swagger docs
3. **Frontend Connection**: Run the frontend and check browser network tab

### Quick Test Commands

```bash
# Test backend health
curl https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net/api/health

# View API documentation
open https://hire-ai-rg-backend-gafpbjhkdgemdsfp.southindia-01.azurewebsites.net/docs
``` 