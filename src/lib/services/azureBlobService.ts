/**
 * Azure Blob Storage Service for Interview Recordings
 * - Direct video upload to Azure Blob Storage
 * - 30-day lifecycle management
 * - Progress tracking for large uploads
 * - Chunked upload for reliability
 */

import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  success: boolean;
  blobUrl?: string;
  error?: string;
  uploadId?: string;
}

interface BlobMetadata {
  interviewId: string;
  sessionId: string;
  candidateName?: string;
  jobTitle?: string;
  recordingDate: string;
  fileSize: string;
  duration?: string;
}

export class AzureBlobService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private readonly containerName = 'interviewvideo';
  
  // Storage account configuration - hardcoded values for browser use
  private readonly storageAccountName = 'pdf1';
  private readonly accountUrl = 'https://pdf1.blob.core.windows.net';
  
  // SAS Token with full permissions - expires 2026-08-12
  // Generated from Azure Portal for 'interviewvideo' container
  private readonly sasToken = 'sp=racwdli&st=2025-07-06T08:49:07Z&se=2026-08-12T16:49:07Z&sv=2024-11-04&sr=c&sig=m%2B0xmQuPsRi%2FBj2%2F%2BQS1VPbVY5pJMjU4IH6zoLekyAE%3D';

  constructor() {
    // Using SAS token for browser compatibility
  }

  /**
   * Initialize Azure Blob Storage client
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing Azure Blob Storage...');
      console.log('📊 Storage Account:', this.storageAccountName);
      console.log('📊 Container Name:', this.containerName);

      if (!this.storageAccountName || !this.sasToken) {
        throw new Error('Azure Storage configuration missing.');
      }

      // Create ContainerClient directly with container-scoped SAS token
      console.log('🔗 Creating ContainerClient with SAS token...');
      const containerSasUrl = `${this.accountUrl}/${this.containerName}?${this.sasToken}`;
      this.containerClient = new ContainerClient(containerSasUrl);

      // Also create BlobServiceClient for account-level operations (if needed)
      console.log('📦 Creating BlobServiceClient...');
      const accountSasUrl = `${this.accountUrl}?${this.sasToken}`;
      this.blobServiceClient = new BlobServiceClient(accountSasUrl);

      // Test connection by listing blobs (works with container-scoped SAS)
      console.log('🧪 Testing container access...');
      
      try {
        // Try to list blobs to test read access
        const blobIter = this.containerClient.listBlobsFlat();
        const firstPage = await blobIter.next();
        
        // Check if we can access the container
        console.log(`✅ Container '${this.containerName}' is accessible`);
        
        if (firstPage.value && firstPage.value.segment && firstPage.value.segment.blobItems.length > 0) {
          console.log(`📊 Container has ${firstPage.value.segment.blobItems.length} blob(s)`);
        } else {
          console.log('📊 Container is empty or no blobs found');
        }
      } catch (containerError: any) {
        if (containerError.statusCode === 404) {
          throw new Error(`Container '${this.containerName}' does not exist. Please create it in Azure Portal first.`);
        } else if (containerError.statusCode === 403) {
          throw new Error(`Access denied to container '${this.containerName}'. Please check your SAS token permissions.`);
        } else {
          console.error('❌ Container access error:', containerError);
          throw containerError;
        }
      }

      console.log('✅ Azure Blob Storage initialized successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to initialize Azure Blob Storage:', error);
      console.error('❌ Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        name: error.name
      });
      return false;
    }
  }

  /**
   * Upload interview recording to Azure Blob Storage
   */
  async uploadRecording(
    videoBlob: Blob,
    metadata: BlobMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${metadata.sessionId}_${timestamp}.webm`;
      const blobName = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;

      console.log(`📤 Starting upload: ${blobName} (${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`);

      // Get block blob client
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      // Prepare blob metadata
      const blobMetadata = {
        interviewId: metadata.interviewId,
        sessionId: metadata.sessionId,
        candidateName: metadata.candidateName || 'Unknown',
        jobTitle: metadata.jobTitle || 'Unknown',
        recordingDate: metadata.recordingDate,
        fileSize: metadata.fileSize,
        duration: metadata.duration || 'Unknown',
        uploadDate: new Date().toISOString(),
        retentionPolicy: '30-days'
      };

      // Upload options
      const uploadOptions = {
        metadata: blobMetadata,
        blobHTTPHeaders: {
          blobContentType: 'video/webm',
          blobCacheControl: 'max-age=31536000' // 1 year cache
        },
        onProgress: onProgress ? (ev: any) => {
          const progress: UploadProgress = {
            loaded: ev.loadedBytes,
            total: videoBlob.size,
            percentage: Math.round((ev.loadedBytes / videoBlob.size) * 100)
          };
          onProgress(progress);
        } : undefined
      };

      // Upload the blob
      const uploadResponse = await blockBlobClient.uploadData(videoBlob, uploadOptions);

      if (uploadResponse.errorCode) {
        throw new Error(`Upload failed: ${uploadResponse.errorCode}`);
      }

      console.log('✅ Upload completed successfully');
      console.log(`📊 Upload details:`, {
        blobUrl: blockBlobClient.url,
        requestId: uploadResponse.requestId,
        etag: uploadResponse.etag
      });

      return {
        success: true,
        blobUrl: blockBlobClient.url,
        uploadId: uploadResponse.requestId
      };

    } catch (error) {
      console.error('❌ Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Upload image file (for user photos, etc.)
   */
  async uploadImage(
    imageBlob: Blob,
    fileName: string,
    metadata?: { [key: string]: string }
  ): Promise<string | null> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      console.log(`📤 Starting image upload: ${fileName} (${(imageBlob.size / 1024).toFixed(2)} KB)`);

      // Get block blob client
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);

      // Prepare blob metadata
      const blobMetadata = {
        uploadDate: new Date().toISOString(),
        fileType: 'image',
        ...metadata
      };

      // Upload options
      const uploadOptions = {
        metadata: blobMetadata,
        blobHTTPHeaders: {
          blobContentType: imageBlob.type || 'image/jpeg',
          blobCacheControl: 'max-age=31536000' // 1 year cache
        }
      };

      // Upload the blob
      const uploadResponse = await blockBlobClient.uploadData(imageBlob, uploadOptions);

      if (uploadResponse.errorCode) {
        throw new Error(`Upload failed: ${uploadResponse.errorCode}`);
      }

      console.log('✅ Image upload completed successfully');
      console.log(`📊 Upload details:`, {
        blobUrl: blockBlobClient.url,
        requestId: uploadResponse.requestId,
        etag: uploadResponse.etag
      });

      return blockBlobClient.url;

    } catch (error) {
      console.error('❌ Image upload failed:', error);
      return null;
    }
  }

  /**
   * Upload with chunked/resumable approach for very large files
   */
  async uploadLargeRecording(
    videoBlob: Blob,
    metadata: BlobMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const chunkSize = 4 * 1024 * 1024; // 4MB chunks
      const totalChunks = Math.ceil(videoBlob.size / chunkSize);
      
      if (totalChunks === 1) {
        // Small file, use regular upload
        return this.uploadRecording(videoBlob, metadata, onProgress);
      }

      console.log(`📤 Starting chunked upload: ${totalChunks} chunks of ${chunkSize / 1024 / 1024}MB each`);

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${metadata.sessionId}_${timestamp}.webm`;
      const blobName = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;

      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      const blockIds: string[] = [];
      let uploadedBytes = 0;

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const blockId = btoa(`block-${i.toString().padStart(6, '0')}`);
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, videoBlob.size);
        const chunk = videoBlob.slice(start, end);

        console.log(`📦 Uploading chunk ${i + 1}/${totalChunks} (${start}-${end})`);

        await blockBlobClient.stageBlock(blockId, chunk, chunk.size);
        blockIds.push(blockId);

        uploadedBytes += chunk.size;

        // Report progress
        if (onProgress) {
          onProgress({
            loaded: uploadedBytes,
            total: videoBlob.size,
            percentage: Math.round((uploadedBytes / videoBlob.size) * 100)
          });
        }
      }

      // Commit all blocks
      console.log('🔗 Committing blocks...');
      const commitResponse = await blockBlobClient.commitBlockList(blockIds, {
        metadata: {
          interviewId: metadata.interviewId,
          sessionId: metadata.sessionId,
          candidateName: metadata.candidateName || 'Unknown',
          jobTitle: metadata.jobTitle || 'Unknown',
          recordingDate: metadata.recordingDate,
          fileSize: metadata.fileSize,
          duration: metadata.duration || 'Unknown',
          uploadDate: new Date().toISOString(),
          retentionPolicy: '30-days'
        },
        blobHTTPHeaders: {
          blobContentType: 'video/webm',
          blobCacheControl: 'max-age=31536000'
        }
      });

      console.log('✅ Chunked upload completed successfully');

      return {
        success: true,
        blobUrl: blockBlobClient.url,
        uploadId: commitResponse.requestId
      };

    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * List all recordings for a specific interview
   */
  async listRecordings(interviewId?: string): Promise<any[]> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const recordings = [];
      const prefix = interviewId ? `${new Date().getFullYear()}/` : '';

      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        // Filter by interview ID if specified
        if (interviewId && blob.metadata?.interviewId !== interviewId) {
          continue;
        }

        recordings.push({
          name: blob.name,
          url: `${this.containerClient.url}/${blob.name}`,
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified,
          metadata: blob.metadata
        });
      }

      return recordings;
    } catch (error) {
      console.error('❌ Failed to list recordings:', error);
      return [];
    }
  }

  /**
   * Delete a recording (manual cleanup)
   */
  async deleteRecording(blobName: string): Promise<boolean> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();

      console.log(`🗑️ Successfully deleted: ${blobName}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
      return false;
    }
  }

  /**
   * Get blob URL with SAS token for secure access
   */
  getBlobUrl(blobName: string): string {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }
    return `${this.containerClient.url}/${blobName}`;
  }

  /**
   * Test basic connectivity to Azure Storage
   */
  async testConnection(): Promise<boolean> {
    try { 
      console.log('🧪 Testing Azure Storage connectivity...');
      
      // Create container client directly with SAS token for container-scoped access
      const containerSasUrl = `${this.accountUrl}/${this.containerName}?${this.sasToken}`;
      const testContainerClient = new ContainerClient(containerSasUrl);
      
      console.log('🔗 Testing container access:', this.containerName);
      
      try {
        // Simply try to list blobs - this is the most basic operation
        console.log('📋 Testing blob listing...');
        const blobIter = testContainerClient.listBlobsFlat();
        const firstPage = await blobIter.next();
        
        // If we get here without error, the connection is working
        if (firstPage.value && firstPage.value.segment) {
          console.log('📄 Container access confirmed');
        } else {
          console.log('📄 Container is accessible (empty or no blobs)');
        }
        
        console.log('✅ Successfully connected to Azure Storage container');
        return true;
      } catch (listError: any) {
        if (listError.statusCode === 403) {
          console.error('❌ Access denied. Please check your SAS token has "List" permission.');
        } else if (listError.statusCode === 404) {
          console.error('❌ Container not found. Please ensure container "interviewvideo" exists.');
        }
        throw listError;
      }
    } catch (error: any) {
      console.error('❌ Azure Storage connectivity test failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        requestId: error.details?.requestId
      });
      return false;
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.storageAccountName && this.sasToken);
  }

  /**
   * Get container statistics
   */
  async getContainerStats(): Promise<any> {
    try {
      if (!this.containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      let totalBlobs = 0;
      let totalSize = 0;

      for await (const blob of this.containerClient.listBlobsFlat()) {
        totalBlobs++;
        totalSize += blob.properties.contentLength || 0;
      }

      return {
        totalBlobs,
        totalSize,
        totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Failed to get container stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const azureBlobService = new AzureBlobService(); 