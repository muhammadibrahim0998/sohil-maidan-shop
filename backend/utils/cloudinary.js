import {
    v2 as cloudinary
} from 'cloudinary';
import fs from 'fs';

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        console.log(`[Cloudinary] Using Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME ? 'FOUND' : 'MISSING'}`);
        // Ensure configuration is set (useful if env vars were loaded late)
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // Upload the file on Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        // Remove the locally stored temporary file after success
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.log("File is uploaded on Cloudinary ", response.url);
        return response;
    } catch (error) {
        // Remove the locally stored temporary file even if upload failed
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.error("Error uploading file to Cloudinary:", error);
        return null;
    }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url 
 * @returns {string|null}
 */
const extractPublicIdFromUrl = (url) => {
    if (!url || !url.includes('cloudinary.com')) return null;

    try {
        const parts = url.split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex === -1) return null;

        // Skip 'upload' and version (starts with 'v' followed by numbers)
        let startIndex = uploadIndex + 1;
        if (parts[startIndex].match(/^v\d+$/)) {
            startIndex++;
        }

        // Join the remaining parts to get the public ID with folder structure
        const publicIdWithExtension = parts.slice(startIndex).join('/');

        // Remove extension
        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        if (lastDotIndex === -1) return publicIdWithExtension;

        return publicIdWithExtension.substring(0, lastDotIndex);
    } catch (e) {
        console.error("Error parsing Cloudinary URL", e);
        return null;
    }
};

/**
 * Delete a file from Cloudinary by its public ID
 * @param {string} publicId 
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        console.log(`Attempting to delete Cloudinary asset: ${publicId}`);
        const response = await cloudinary.uploader.destroy(publicId, {
            invalidate: true
        });
        console.log(`Cloudinary deletion response:`, response);
        return response;
    } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        return null;
    }
};

export {
    cloudinary,
    uploadOnCloudinary,
    extractPublicIdFromUrl,
    deleteFromCloudinary
};