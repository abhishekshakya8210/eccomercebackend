import mongoose from "mongoose";
import Product from "../model/productmodel.js";
import Category from "../model/categorymodel.js";
import {
    uploadImageToCloudinary,
    deleteImageFromCloudinary,
    deleteMultipleImagesFromCloudinary,
} from "../config/cloudinary.js";

// escape regex for search
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// create product
export const createProduct = async (req, res) => {
    const uploadedImages = []; // Track Cloudinary uploads for rollback on failure

    try {
        const {
            name,
            description,
            price,
            compareAtPrice,
            category,
            stock,
            sku,
            brand,
            isActive,
        } = req.body;

        // 1. Basic required fields validation
        if (!name || !description || price === undefined || stock === undefined || !sku) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Please provide all required fields: name, description, price, stock, and sku.",
            });
        }

        const numPrice = Number(price);
        const numStock = Number(stock);

        if (isNaN(numPrice) || numPrice < 0) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Price must be a valid non-negative number.",
            });
        }

        if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Stock must be a valid non-negative integer.",
            });
        }

        let numCompareAtPrice = null;
        if (compareAtPrice !== undefined && compareAtPrice !== "" && compareAtPrice !== null) {
            numCompareAtPrice = Number(compareAtPrice);
            if (isNaN(numCompareAtPrice) || numCompareAtPrice < 0) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "compareAtPrice must be a valid non-negative number.",
                });
            }
            if (numCompareAtPrice < numPrice) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "compareAtPrice must be greater than or equal to current price.",
                });
            }
        }

        // 2. Validate SKU uniqueness before uploading images to save Cloudinary quota
        const formattedSku = String(sku).trim().toUpperCase();
        const existingSku = await Product.findOne({ sku: formattedSku });
        if (existingSku) {
            return res.status(400).json({
                success: false,
                status: false,
                message: `Product with SKU '${formattedSku}' already exists. SKU must be unique.`,
            });
        }

        // 3. Validate category ID if provided
        let categoryId = null;
        if (category && category !== "" && category !== "null") {
            if (!mongoose.Types.ObjectId.isValid(category)) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Invalid Category ID format.",
                });
            }
            const existingCategory = await Category.findById(category);
            if (!existingCategory) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Referenced category not found.",
                });
            }
            categoryId = existingCategory._id;
        }

        // 4. Upload images to Cloudinary (if files provided)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadResult = await uploadImageToCloudinary(file.buffer, "ecommerce/products");
                uploadedImages.push(uploadResult);
            }
        }

        // 5. Create product in MongoDB (createdBy strictly set from req.user._id)
        const productData = {
            name: String(name).trim(),
            description: String(description).trim(),
            price: numPrice,
            compareAtPrice: numCompareAtPrice,
            category: categoryId,
            images: uploadedImages,
            stock: numStock,
            sku: formattedSku,
            brand: brand ? String(brand).trim() : "",
            isActive: isActive !== undefined ? (isActive === true || isActive === "true") : true,
            createdBy: req.user._id,
        };

        const newProduct = await Product.create(productData);

        return res.status(201).json({
            success: true,
            status: true,
            message: "Product created successfully.",
            data: newProduct,
        });
    } catch (error) {
        // ROLLBACK: If MongoDB creation failed after Cloudinary uploads, clean up uploaded images
        if (uploadedImages.length > 0) {
            const publicIds = uploadedImages.map((img) => img.publicId);
            await deleteMultipleImagesFromCloudinary(publicIds);
        }

        console.error("Create product error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Duplicate key error: A product with this SKU already exists.",
            });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                status: false,
                message: messages.join(", "),
            });
        }

        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while creating product.",
        });
    }
};

// update product
export const updateProduct = async (req, res) => {
    const newUploadedImages = [];

    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Invalid product ID format.",
            });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                status: false,
                message: "Product not found.",
            });
        }

        const {
            name,
            description,
            price,
            compareAtPrice,
            category,
            stock,
            sku,
            brand,
            isActive,
            replaceImages,
            deleteImagePublicIds,
        } = req.body;

        // 1. Validate permitted updates
        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Product name cannot be empty.",
                });
            }
            product.name = String(name).trim();
        }

        if (description !== undefined) {
            if (!String(description).trim()) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Product description cannot be empty.",
                });
            }
            product.description = String(description).trim();
        }

        if (price !== undefined) {
            const numPrice = Number(price);
            if (isNaN(numPrice) || numPrice < 0) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Price must be a valid non-negative number.",
                });
            }
            product.price = numPrice;
        }

        if (compareAtPrice !== undefined) {
            if (compareAtPrice === "" || compareAtPrice === null) {
                product.compareAtPrice = null;
            } else {
                const numCompareAtPrice = Number(compareAtPrice);
                if (isNaN(numCompareAtPrice) || numCompareAtPrice < 0) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "compareAtPrice must be a valid non-negative number.",
                    });
                }
                if (numCompareAtPrice < product.price) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "compareAtPrice must be greater than or equal to current price.",
                    });
                }
                product.compareAtPrice = numCompareAtPrice;
            }
        }

        if (stock !== undefined) {
            const numStock = Number(stock);
            if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Stock must be a valid non-negative integer.",
                });
            }
            product.stock = numStock;
        }

        if (sku !== undefined) {
            const formattedSku = String(sku).trim().toUpperCase();
            if (!formattedSku) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "SKU cannot be empty.",
                });
            }
            // Check if SKU is in use by another product
            const existingSku = await Product.findOne({ sku: formattedSku, _id: { $ne: id } });
            if (existingSku) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: `SKU '${formattedSku}' is already taken by another product.`,
                });
            }
            product.sku = formattedSku;
        }

        if (brand !== undefined) {
            product.brand = String(brand).trim();
        }

        if (category !== undefined) {
            if (category === "" || category === null || category === "null") {
                product.category = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(category)) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "Invalid Category ID format.",
                    });
                }
                const existingCategory = await Category.findById(category);
                if (!existingCategory) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "Referenced category not found.",
                    });
                }
                product.category = existingCategory._id;
            }
        }

        if (isActive !== undefined) {
            product.isActive = isActive === true || isActive === "true";
        }

        // 2. Handle image deletions if specified
        let imagesToDeleteFromCloudinary = [];
        if (deleteImagePublicIds) {
            let idsToDelete = [];
            if (Array.isArray(deleteImagePublicIds)) {
                idsToDelete = deleteImagePublicIds;
            } else if (typeof deleteImagePublicIds === "string") {
                try {
                    idsToDelete = JSON.parse(deleteImagePublicIds);
                } catch {
                    idsToDelete = [deleteImagePublicIds];
                }
            }

            if (idsToDelete.length > 0) {
                imagesToDeleteFromCloudinary.push(...idsToDelete);
                product.images = product.images.filter(
                    (img) => !idsToDelete.includes(img.publicId)
                );
            }
        }

        // 3. Handle new image uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadResult = await uploadImageToCloudinary(file.buffer, "ecommerce/products");
                newUploadedImages.push(uploadResult);
            }

            const shouldReplace = replaceImages === true || replaceImages === "true";
            if (shouldReplace) {
                // Mark all previous images for deletion
                imagesToDeleteFromCloudinary.push(...product.images.map((img) => img.publicId));
                product.images = newUploadedImages;
            } else {
                // Append new images (up to 5 total)
                product.images = [...product.images, ...newUploadedImages].slice(0, 5);
            }
        }

        await product.save();

        // Safely clean up removed Cloudinary images after successful save
        if (imagesToDeleteFromCloudinary.length > 0) {
            await deleteMultipleImagesFromCloudinary(imagesToDeleteFromCloudinary);
        }

        return res.status(200).json({
            success: true,
            status: true,
            message: "Product updated successfully.",
            data: product,
        });
    } catch (error) {
        // Rollback any newly uploaded images on error
        if (newUploadedImages.length > 0) {
            const publicIds = newUploadedImages.map((img) => img.publicId);
            await deleteMultipleImagesFromCloudinary(publicIds);
        }

        console.error("Update product error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Duplicate key error: A product with this SKU already exists.",
            });
        }

        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while updating product.",
        });
    }
};

// delete product
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Invalid product ID format.",
            });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                status: false,
                message: "Product not found.",
            });
        }

        // Collect all Cloudinary publicIds to clean up
        const publicIds = product.images.map((img) => img.publicId).filter(Boolean);

        // Delete from database
        await Product.findByIdAndDelete(id);

        // Clean up Cloudinary assets
        if (publicIds.length > 0) {
            await deleteMultipleImagesFromCloudinary(publicIds);
        }

        return res.status(200).json({
            success: true,
            status: true,
            message: "Product and associated images deleted successfully.",
        });
    } catch (error) {
        console.error("Delete product error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while deleting product.",
        });
    }
};

// change product status
export const updateProductStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Invalid product ID format.",
            });
        }

        if (isActive === undefined) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Please provide 'isActive' boolean value.",
            });
        }

        const boolStatus = isActive === true || isActive === "true";

        const product = await Product.findByIdAndUpdate(
            id,
            { isActive: boolStatus },
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                status: false,
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            success: true,
            status: true,
            message: `Product ${boolStatus ? "activated" : "deactivated"} successfully.`,
            data: product,
        });
    } catch (error) {
        console.error("Update product status error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while updating product status.",
        });
    }
};

// get all products for admin
export const getAdminProducts = async (req, res) => {
    try {
        const {
            search,
            category,
            brand,
            isActive,
            minPrice,
            maxPrice,
            inStock,
            sort,
            page = 1,
            limit = 10,
        } = req.query;

        const query = {};

        if (isActive !== undefined) {
            query.isActive = isActive === "true" || isActive === true;
        }

        if (category && mongoose.Types.ObjectId.isValid(category)) {
            query.category = category;
        }

        if (brand) {
            query.brand = { $regex: new RegExp(`^${escapeRegex(brand)}$`, "i") };
        }

        if (inStock === "true" || inStock === true) {
            query.stock = { $gt: 0 };
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined && !isNaN(Number(minPrice))) {
                query.price.$gte = Number(minPrice);
            }
            if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
                query.price.$lte = Number(maxPrice);
            }
        }

        if (search && String(search).trim()) {
            const cleanSearch = escapeRegex(String(search).trim());
            query.$or = [
                { name: { $regex: cleanSearch, $options: "i" } },
                { description: { $regex: cleanSearch, $options: "i" } },
                { brand: { $regex: cleanSearch, $options: "i" } },
                { sku: { $regex: cleanSearch, $options: "i" } },
            ];
        }

        // Sorting
        let sortOption = { createdAt: -1, _id: 1 };
        if (sort === "price_asc") sortOption = { price: 1, _id: 1 };
        else if (sort === "price_desc") sortOption = { price: -1, _id: 1 };
        else if (sort === "newest") sortOption = { createdAt: -1, _id: 1 };
        else if (sort === "oldest") sortOption = { createdAt: 1, _id: 1 };

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const [products, total] = await Promise.all([
            Product.find(query)
                .populate("category", "name")
                .populate("createdBy", "name email")
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            status: true,
            message: "Admin products fetched successfully.",
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Get admin products error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while fetching admin products.",
        });
    }
};

// get single product for admin
export const getAdminProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Invalid product ID format.",
            });
        }

        const product = await Product.findById(id)
            .populate("category", "name description")
            .populate("createdBy", "name email");

        if (!product) {
            return res.status(404).json({
                success: false,
                status: false,
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            success: true,
            status: true,
            message: "Product details fetched successfully.",
            data: product,
        });
    } catch (error) {
        console.error("Get admin product by ID error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while fetching product details.",
        });
    }
};

// get active products with filters and search
export const getProducts = async (req, res) => {
    try {
        const {
            search,
            category,
            brand,
            minPrice,
            maxPrice,
            inStock,
            sort,
            page = 1,
            limit = 10,
        } = req.query;

        // Customer queries only return active products
        const query = { isActive: true };

        // 1. Category Filter
        if (category) {
            if (!mongoose.Types.ObjectId.isValid(category)) {
                return res.status(400).json({
                    success: false,
                    status: false,
                    message: "Invalid category ID format.",
                });
            }
            query.category = category;
        }

        // 2. Brand Filter (case-insensitive exact match)
        if (brand && String(brand).trim()) {
            query.brand = { $regex: new RegExp(`^${escapeRegex(String(brand).trim())}$`, "i") };
        }

        // 3. Price Range Filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined && minPrice !== "") {
                const parsedMin = Number(minPrice);
                if (isNaN(parsedMin) || parsedMin < 0) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "minPrice must be a valid non-negative number.",
                    });
                }
                query.price.$gte = parsedMin;
            }

            if (maxPrice !== undefined && maxPrice !== "") {
                const parsedMax = Number(maxPrice);
                if (isNaN(parsedMax) || parsedMax < 0) {
                    return res.status(400).json({
                        success: false,
                        status: false,
                        message: "maxPrice must be a valid non-negative number.",
                    });
                }
                query.price.$lte = parsedMax;
            }
        }

        // 4. inStock Filter
        if (inStock === "true" || inStock === true) {
            query.stock = { $gt: 0 };
        }

        // 5. Search Filter (Safe regex search across name, description, brand)
        if (search && String(search).trim()) {
            const cleanSearch = escapeRegex(String(search).trim());
            query.$or = [
                { name: { $regex: cleanSearch, $options: "i" } },
                { description: { $regex: cleanSearch, $options: "i" } },
                { brand: { $regex: cleanSearch, $options: "i" } },
            ];
        }

        // 6. Sorting
        let sortOption = { createdAt: -1, _id: 1 };
        if (sort === "price_asc") sortOption = { price: 1, _id: 1 };
        else if (sort === "price_desc") sortOption = { price: -1, _id: 1 };
        else if (sort === "newest") sortOption = { createdAt: -1, _id: 1 };
        else if (sort === "oldest") sortOption = { createdAt: 1, _id: 1 };

        // 7. Pagination
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const [products, total] = await Promise.all([
            Product.find(query)
                .populate("category", "name")
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .select("-__v")
                .lean(),
            Product.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            status: true,
            message: "Products fetched successfully.",
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Get products error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while fetching products.",
        });
    }
};

// get single product by id
export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Invalid product ID format.",
            });
        }

        // Only active products are accessible through the public endpoint
        const product = await Product.findOne({ _id: id, isActive: true })
            .populate("category", "name description")
            .populate("createdBy", "name email")
            .select("-__v");

        if (!product) {
            return res.status(404).json({
                success: false,
                status: false,
                message: "Product not found or unavailable.",
            });
        }

        return res.status(200).json({
            success: true,
            status: true,
            message: "Product details fetched successfully.",
            data: product,
        });
    } catch (error) {
        console.error("Get product by ID error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while fetching product details.",
        });
    }
};

// create category
export const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Category name is required.",
            });
        }

        const cleanName = String(name).trim();
        const existing = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, "i") } });
        if (existing) {
            return res.status(400).json({
                success: false,
                status: false,
                message: "Category already exists.",
            });
        }

        const category = await Category.create({
            name: cleanName,
            description: description ? String(description).trim() : "",
        });

        return res.status(201).json({
            success: true,
            status: true,
            message: "Category created successfully.",
            data: category,
        });
    } catch (error) {
        console.error("Create category error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while creating category.",
        });
    }
};

// get all categories
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
        return res.status(200).json({
            success: true,
            status: true,
            message: "Categories fetched successfully.",
            data: categories,
        });
    } catch (error) {
        console.error("Get categories error:", error);
        return res.status(500).json({
            success: false,
            status: false,
            message: "Internal server error while fetching categories.",
        });
    }
};
