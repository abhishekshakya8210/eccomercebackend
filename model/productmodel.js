import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: [true, "Image URL is required"],
            trim: true,
        },
        publicId: {
            type: String,
            required: [true, "Image publicId is required"],
            trim: true,
        },
    },
    { _id: false }
);

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            maxlength: [200, "Product name cannot exceed 200 characters"],
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
            trim: true,
        },
        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Product price cannot be negative"],
        },
        compareAtPrice: {
            type: Number,
            min: [0, "Compare at price cannot be negative"],
            validate: {
                validator: function (value) {
                    // compareAtPrice should be >= price if provided
                    if (value == null) return true;
                    return value >= this.price;
                },
                message: "compareAtPrice must be greater than or equal to current price",
            },
            default: null,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "category",
            default: null,
        },
        images: {
            type: [imageSchema],
            default: [],
        },
        stock: {
            type: Number,
            required: [true, "Product stock is required"],
            min: [0, "Product stock cannot be negative"],
            validate: {
                validator: Number.isInteger,
                message: "Stock must be an integer",
            },
            default: 0,
        },
        sku: {
            type: String,
            required: [true, "Product SKU is required"],
            unique: true,
            trim: true,
            uppercase: true,
        },
        brand: {
            type: String,
            trim: true,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: [true, "Product createdBy admin user is required"],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// indexes for filters and sorting
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });

// search index
productSchema.index({
    name: "text",
    description: "text",
    brand: "text",
});

const Product = mongoose.models.product || mongoose.model("product", productSchema);

export default Product;
