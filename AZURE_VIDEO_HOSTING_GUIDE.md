# Azure Video Hosting Solutions for Static Web Apps

## Problem: Azure Static Web Apps Video Serving Issues

Azure Static Web Apps has limitations when serving large video files:
- Navigation fallback interferes with video MIME types
- File serving limitations for media content
- Configuration changes may not take effect immediately

## Solution 1: Azure Blob Storage (Recommended)

### Step 1: Create Azure Storage Account
1. Go to Azure Portal
2. Create a new Storage Account
3. Choose:
   - Performance: Standard
   - Redundancy: LRS (Locally-redundant storage) for cost efficiency
   - Location: Same region as your Static Web App

### Step 2: Upload Video to Blob Storage
1. In your Storage Account, go to "Containers"
2. Create a new container called "videos"
3. Set access level to "Blob (anonymous read access for blobs only)"
4. Upload your `ai-avatar.mp4` file

### Step 3: Enable CORS on Storage Account
1. Go to Storage Account > Settings > CORS
2. Add a CORS rule:
   - Allowed origins: `*` (or your specific domain)
   - Allowed methods: GET, HEAD
   - Allowed headers: `*`
   - Exposed headers: `*`
   - Max age: 3600

### Step 4: Get the Video URL
Your video URL will be:
```
https://[storage-account-name].blob.core.windows.net/videos/ai-avatar.mp4
```

### Step 5: Update Your Code
Replace the video source in your code:
```javascript
// Instead of:
video.src = '/ai-avatar.mp4';

// Use:
video.src = 'https://[storage-account-name].blob.core.windows.net/videos/ai-avatar.mp4';
```

## Solution 2: Use a CDN (Content Delivery Network)

### Option A: Azure CDN
1. Create an Azure CDN profile
2. Create a CDN endpoint pointing to your blob storage
3. Use the CDN URL in your application

### Option B: External Video Hosting
- Upload to YouTube (unlisted) and use embed URL
- Use Cloudinary, Vimeo, or other video hosting services
- Use GitHub Releases to host the file (if under 2GB)

## Solution 3: Optimize Video for Web

### Compress the Video
Use FFmpeg to optimize:
```bash
ffmpeg -i ai-avatar.mp4 -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k -movflags +faststart ai-avatar-optimized.mp4
```

### Create Multiple Formats
```bash
# WebM for better compression
ffmpeg -i ai-avatar.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 ai-avatar.webm

# Lower resolution version
ffmpeg -i ai-avatar.mp4 -vf scale=640:360 -c:v libx264 -preset slow -crf 23 ai-avatar-360p.mp4
```

## Implementation Code Update

```typescript
// Multiple source fallback approach
const videoSources = [
  // Primary: Azure Blob Storage
  'https://yourstorage.blob.core.windows.net/videos/ai-avatar.mp4',
  // Fallback 1: CDN
  'https://yourcdn.azureedge.net/videos/ai-avatar.mp4',
  // Fallback 2: External hosting
  'https://github.com/yourrepo/releases/download/v1.0/ai-avatar.mp4'
];

let currentSourceIndex = 0;

const loadNextSource = () => {
  if (currentSourceIndex < videoSources.length) {
    video.src = videoSources[currentSourceIndex];
    video.load();
    currentSourceIndex++;
  } else {
    // All sources failed, show fallback UI
    showFallback();
  }
};

video.addEventListener('error', () => {
  console.log(`Failed to load source ${currentSourceIndex}, trying next...`);
  loadNextSource();
});

// Start loading
loadNextSource();
```

## Quick Fix: Use External Video URL

For immediate testing, use this sample video URL:
```javascript
video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
```

Then replace with your hosted video URL once confirmed working. 