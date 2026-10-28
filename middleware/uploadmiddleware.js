import multer from "multer";

// Allowed MIME types for product images
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES = 5; // Up to 5 product images

// Configure Multer with memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
    } else {
        cb(
            new multer.MulterError(
                "LIMIT_UNEXPECTED_FILE",
                `Invalid file type '${file.mimetype}'. Only JPEG, JPG, PNG, and WebP images are allowed.`
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
    },
    fileFilter,
});

/**
 * Express middleware wrapper to handle multer errors gracefully
 * and return structured JSON 400 errors instead of crashing.
 */
export const uploadProductImages = (fieldName = "images", maxCount = MAX_FILES) => {
    const multerUpload = upload.array(fieldName, maxCount);

    return (req, res, next) => {
        multerUpload(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === "LIMIT_FILE_SIZE") {
                        return res.status(400).json({
                            success: false,
                            status: false,
                            message: `File size exceeds the 5MB limit. Please upload smaller images.`,
                        });
                    }
                    if (err.code === "LIMIT_FILE_COUNT") {
                        return res.status(400).json({
                            success: false,
                            status: false,
                            message: `Too many files. You can upload a maximum of ${maxCount} images.`,
                        });
                    }
                    if (err.code === "LIMIT_UNEXPECTED_FILE") {
                        return res.status(400).json({
                            success: false,
                            status: false,
                            message: err.message || `Unexpected field or invalid image type. Expected field: '${fieldName}'.`,
                        });
                    }
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: `Upload error: ${err.message}`,
                    });
                }
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: err.message || "Failed to process uploaded files.",
                });
            }
            next();
        });
    };
};

export default uploadProductImages;
