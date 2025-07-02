# Frontend Environment Setup

## API Configuration

The frontend is configured to connect to the backend API at Azure:

### Default Configuration
The application is now configured to use the Azure backend by default:
- **Production Backend URL**: `https://backendb2b.azurewebsites.net`

### Environment Variables
You can override the default backend URL by setting the `VITE_API_BASE_URL` environment variable.

Create a `.env` file in the project root:
```env
# For production (Azure backend)
VITE_API_BASE_URL=https://backendb2b.azurewebsites.net

# For local development (uncomment to use)
# VITE_API_BASE_URL=http://localhost:8000
```

### Files Updated
The following files have been updated to use the Azure backend URL:
1. `src/lib/api.ts` - Main API service configuration
2. `src/lib/services/interviewService.ts` - Interview service API calls
3. `src/pages/VideoInterview.tsx` - Video interview page API calls

### Building for Production
When building for production, ensure the correct API URL is set:
```bash
# Using environment variable
VITE_API_BASE_URL=https://backendb2b.azurewebsites.net npm run build

# Or the default is already set to Azure
npm run build
```

### Switching Between Environments
To switch between local and production backends:
1. Update the `.env` file with the desired URL
2. Restart the development server (`npm run dev`)
3. For production builds, rebuild the application 