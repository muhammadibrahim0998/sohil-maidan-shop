import express from 'express';
import multer from 'multer';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticate, preventSuperAdmin } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Use disk storage to a temp folder so cloudinary.js can read and clean up the file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '..', 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// File type filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files (JPEG, JPG, PNG, WEBP, GIF, AVIF) are allowed!'));
  }
};

const upload = multer({ storage, fileFilter });

// Helper to save image with Cloudinary or fallback to local /uploads
const saveImageFile = async (file, req) => {
  let url = null;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await uploadOnCloudinary(file.path);
      if (result?.secure_url) {
        url = result.secure_url;
      }
    } catch (err) {
      console.warn(`[Upload] Cloudinary upload failed, using fallback:`, err.message);
    }
  }

  // Fallback to local /uploads static directory
  if (!url) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const newFilename = `proof-${Date.now()}-${path.basename(file.path)}`;
    const destPath = path.join(uploadsDir, newFilename);
    fs.copyFileSync(file.path, destPath);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    const protocol = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
    const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
    const backendUrl = process.env.BACKEND_URL || (host ? `${protocol}://${host}` : '');
    url = backendUrl ? `${backendUrl}/uploads/${newFilename}` : `/uploads/${newFilename}`;
  }
  return url;
};

// @desc    Upload images to Cloudinary (Authenticated)
// @route   POST /api/upload
router.post(
  '/',
  authenticate,
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, 'Please upload at least one image');
    }

    const uploadedUrls = [];
    for (const file of req.files) {
      const url = await saveImageFile(file, req);
      uploadedUrls.push(url);
    }

    return res.status(200).json({ 
      images: uploadedUrls,
      message: 'Images uploaded successfully' 
    });
  })
);

// @desc    Public upload route for customer payment proofs
// @route   POST /api/upload/public
router.post(
  '/public',
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, 'Please upload at least one image');
    }

    const uploadedUrls = [];
    for (const file of req.files) {
      const url = await saveImageFile(file, req);
      uploadedUrls.push(url);
    }

    return res.status(200).json({ 
      images: uploadedUrls,
      message: 'Payment proof screenshot uploaded successfully' 
    });
  })
);

export default router;
