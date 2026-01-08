
import { getSupabase } from './supabaseClient';

// Bucket Configuration
// Endpoint: https://cmffxxirhtetvkvreznh.storage.supabase.co/storage/v1/s3
// Region: ap-southeast-2
const BUCKET_NAME = 'uploads'; 

/**
 * Uploads a file (Image or Video) to Supabase Storage and returns the public URL.
 * Supports S3-compatible storage backend.
 * @param file The File or Blob object to upload
 * @param folder The folder path (e.g., 'diagnosis', 'chats', 'community')
 * @returns The public URL of the uploaded file, or null if failed
 */
export const uploadFile = async (file: File | Blob, folder: string): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.error("[Storage] Supabase client not initialized");
        return null;
    }

    try {
        const timestamp = Date.now();
        // Generate a random string for uniqueness
        const randomString = Math.random().toString(36).substring(2, 10);
        
        // Robust Extension Detection for S3
        let ext = 'bin';
        if (file instanceof File) {
            const parts = file.name.split('.');
            if (parts.length > 1) ext = parts.pop()?.toLowerCase() || 'bin';
        } 
        
        // Fallback for Blobs or missing extensions based on MIME type
        if (ext === 'bin' || !ext) {
            const mime = file.type;
            if (mime.includes('image/jpeg')) ext = 'jpg';
            else if (mime.includes('image/png')) ext = 'png';
            else if (mime.includes('image/webp')) ext = 'webp';
            else if (mime.includes('image/gif')) ext = 'gif';
            else if (mime.includes('video/mp4')) ext = 'mp4';
            else if (mime.includes('video/webm')) ext = 'webm';
            else if (mime.includes('video/quicktime')) ext = 'mov';
            else if (mime.includes('video/x-matroska')) ext = 'mkv';
            else if (mime.includes('pdf')) ext = 'pdf';
        }

        // Sanitize folder name
        const cleanFolder = folder.replace(/\/$/, '');
        const filePath = `${cleanFolder}/${timestamp}_${randomString}.${ext}`;

        console.log(`[Storage] Uploading ${file.type} to '${BUCKET_NAME}/${filePath}'`);

        // Convert to ArrayBuffer to ensure binary compatibility
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = new Uint8Array(arrayBuffer);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, fileBuffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'application/octet-stream'
            });

        if (error) {
            console.error('[Storage] Upload Error:', error);
            return null;
        }

        // Get Public URL (Mapped to S3 Object)
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            console.error('[Storage] Failed to generate public URL');
            return null;
        }

        return publicUrlData.publicUrl;

    } catch (e) {
        console.error('[Storage] Exception:', e);
        return null;
    }
};

// Alias for backward compatibility with existing components
export const uploadImage = uploadFile;
