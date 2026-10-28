import express from "express";
import authMiddleware, { adminMiddleware } from "../middleware/authmiddleware.js";
import uploadProductImages from "../middleware/uploadmiddleware.js";
import {
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStatus,
    getAdminProducts,
    getAdminProductById,
    getProducts,
    getProductById,
    createCategory,
    getCategories,
} from "../controllers/productcontroller.js";

const router = express.Router();

// public routes
router.get("/products", getProducts);
router.get("/products/:id", getProductById);
router.get("/categories", getCategories);

// admin routes (need login and admin role)


// POST /api/v1/admin/categories - Create new product category
router.post("/admin/categories", authMiddleware, adminMiddleware, createCategory);

// GET /api/v1/admin/products - List all products (active and inactive) for admin
router.get("/admin/products", authMiddleware, adminMiddleware, getAdminProducts);

// GET /api/v1/admin/products/:id - View any product by ID (including inactive)
router.get("/admin/products/:id", authMiddleware, adminMiddleware, getAdminProductById);

// POST /api/v1/admin/products - Create product with multipart image upload
router.post(
    "/admin/products",
    authMiddleware,
    adminMiddleware,
    uploadProductImages("images", 5),
    createProduct
);

// PATCH /api/v1/admin/products/:id/status - Toggle product active status
router.patch("/admin/products/:id/status", authMiddleware, adminMiddleware, updateProductStatus);

// PATCH /api/v1/admin/products/:id - Update product fields and manage images
router.patch(
    "/admin/products/:id",
    authMiddleware,
    adminMiddleware,
    uploadProductImages("images", 5),
    updateProduct
);

// DELETE /api/v1/admin/products/:id - Delete product and clean up Cloudinary assets
router.delete("/admin/products/:id", authMiddleware, adminMiddleware, deleteProduct);

export default router;
