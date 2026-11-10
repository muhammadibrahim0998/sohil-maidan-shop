import fs from 'fs';
import path from 'path';
import {
    deleteFromCloudinary,
    extractPublicIdFromUrl
} from './cloudinary.js';

/**
 * Normalizes a path to ensure it's relative and clean
 * @param {string} filePath - The path or URL to normalize
 * @returns {string} - The clean relative path (e.g., /uploads/file.jpg)
 */
export const normalizePath = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return '';

    let clean = filePath;

    // Check if it's a Cloudinary URL
    if (clean.includes('res.cloudinary.com')) {
        return clean;
    }

    // If it's an absolute URL, get the path part
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
        try {
            const url = new URL(clean);
            clean = url.pathname;
        } catch (e) {
            // fallback if URL is invalid
            if (clean.includes('/uploads/')) {
                clean = clean.substring(clean.indexOf('/uploads/'));
            } else if (clean.includes('/public/temp/')) {
                clean = clean.substring(clean.indexOf('/public/temp/'));
            }
        }
    }

    // Handle /uploads and /public/temp
    if (clean.includes('/uploads/')) {
        clean = clean.substring(clean.indexOf('/uploads/'));
    } else if (clean.includes('/public/temp/')) {
        clean = clean.substring(clean.indexOf('/public/temp/'));
    }

    // Replace backslashes with forward slashes
    clean = clean.replace(/\\/g, '/');

    // Ensure leading slash
    if (!clean.startsWith('/')) {
        clean = '/' + clean;
    }

    return clean;
};

/**
 * Deletes a file from the disk
 * @param {string} filePath - The relative path of the file (e.g., /uploads/file.jpg)
 */
export const deleteFile = async (filePath) => {
    if (!filePath) return;

    // Normalize path first
    const cleanPath = normalizePath(filePath);

    // Security check: Don't allow deleting files outside of allowed directories
    if (cleanPath.includes('cloudinary.com')) {
        console.log(`Processing Cloudinary deletion for URL: ${cleanPath}`);
        const publicId = extractPublicIdFromUrl(cleanPath);
        if (publicId) {
            await deleteFromCloudinary(publicId);
        } else {
            console.warn(`Could not extract public ID from Cloudinary URL: ${cleanPath}`);
        }
        return;
    }

    if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/public/temp/')) {
        console.warn(`Attempted to delete file outside of allowed directories: ${cleanPath}`);
        return;
    }

    // Convert relative URL path to absolute system path
    // Remove the leading slash for path.resolve to work correctly with process.cwd()
    const systemPath = path.join(process.cwd(), cleanPath.slice(1));

    if (fs.existsSync(systemPath)) {
        try {
            fs.unlinkSync(systemPath);
            console.log(`Successfully deleted file: ${systemPath}`);
        } catch (err) {
            console.error(`Error deleting file ${systemPath}:`, err);
        }
    } else {
        console.warn(`File not found for deletion: ${systemPath}`);
    }
};