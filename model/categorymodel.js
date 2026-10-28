import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            trim: true,
            maxlength: [100, "Category name cannot exceed 100 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, "Category description cannot exceed 500 characters"],
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// index for active status filter
categorySchema.index({ isActive: 1 });

const Category = mongoose.models.category || mongoose.model("category", categorySchema);

export default Category;
