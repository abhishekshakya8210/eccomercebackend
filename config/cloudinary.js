import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from Multer memory storage
 * @param {string} folder - Target Cloudinary folder
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const uploadImageToCloudinary = (buffer, folder = "ecommerce/products") => {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return reject(new Error("Cloudinary credentials are not configured in environment variables."));
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                });
            }
        );

        uploadStream.end(buffer);
    });
};

/**
 * Delete a single image from Cloudinary by public ID
 * @param {string} publicId
 * @returns {Promise<any>}
 */
export const deleteImageFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        if (!process.env.CLOUDINARY_CLOUD_NAME) return null;
        return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error(`Failed to delete Cloudinary image [${publicId}]:`, error.message);
        return null;
    }
};

/**
 * Safely delete multiple images from Cloudinary
 * @param {Array<string>} publicIds
 * @returns {Promise<void>}
 */
export const deleteMultipleImagesFromCloudinary = async (publicIds = []) => {
    if (!Array.isArray(publicIds) || publicIds.length === 0) return;
    await Promise.allSettled(
        publicIds.map((id) => deleteImageFromCloudinary(id))
    );
};

export default cloudinary;
