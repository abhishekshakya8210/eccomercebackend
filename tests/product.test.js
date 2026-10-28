import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models & Middleware
import Product from "../model/productmodel.js";
import Category from "../model/categorymodel.js";
import User from "../model/usermodel.js";
import authMiddleware, { adminMiddleware } from "../middleware/authmiddleware.js";
import { uploadProductImages } from "../middleware/uploadmiddleware.js";
import {
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStatus,
    getProductById,
} from "../controllers/productcontroller.js";

test("Product Model Schema Validations", async (t) => {
    await t.test("should fail validation if required fields (name, price, sku, createdBy) are missing", async () => {
        const product = new Product({});
        let err;
        try {
            await product.validate();
        } catch (e) {
            err = e;
        }
        assert.ok(err, "Validation error expected");
        assert.ok(err.errors.name, "name is required");
        assert.ok(err.errors.description, "description is required");
        assert.ok(err.errors.price, "price is required");
        assert.ok(err.errors.sku, "sku is required");
        assert.ok(err.errors.createdBy, "createdBy is required");
    });

    await t.test("should fail validation if price or stock is negative", async () => {
        const product = new Product({
            name: "Test Shoes",
            description: "High quality sneakers",
            price: -50,
            stock: -5,
            sku: "SHOES-001",
            createdBy: new mongoose.Types.ObjectId(),
        });
        let err;
        try {
            await product.validate();
        } catch (e) {
            err = e;
        }
        assert.ok(err, "Validation error expected");
        assert.ok(err.errors.price, "Negative price should fail");
        assert.ok(err.errors.stock, "Negative stock should fail");
    });

    await t.test("should fail validation if compareAtPrice is less than price", async () => {
        const product = new Product({
            name: "Test Shoes",
            description: "High quality sneakers",
            price: 500,
            compareAtPrice: 400, // Invalid: compareAtPrice must be >= price
            stock: 10,
            sku: "SHOES-002",
            createdBy: new mongoose.Types.ObjectId(),
        });
        let err;
        try {
            await product.validate();
        } catch (e) {
            err = e;
        }
        assert.ok(err, "Validation error expected");
        assert.ok(err.errors.compareAtPrice, "compareAtPrice < price should fail");
    });

    await t.test("should pass validation with valid data", async () => {
        const product = new Product({
            name: "Premium Leather Jacket",
            description: "Genuine leather jacket for winter",
            price: 2999,
            compareAtPrice: 3999,
            stock: 25,
            sku: "JACKET-001",
            brand: "UrbanStyle",
            isActive: true,
            createdBy: new mongoose.Types.ObjectId(),
        });
        let err;
        try {
            await product.validate();
        } catch (e) {
            err = e;
        }
        assert.equal(err, undefined, "Valid product should pass validation");
    });
});

test("Authorization Middleware (Admin Role Protection)", async (t) => {
    await t.test("should return 401 if req.user is missing", () => {
        const req = {};
        let codeCaptured = null;
        let jsonCaptured = null;

        const res = {
            status: function (code) {
                codeCaptured = code;
                return this;
            },
            json: function (data) {
                jsonCaptured = data;
            },
        };
        adminMiddleware(req, res, () => assert.fail("Should not call next()"));
        assert.equal(codeCaptured, 401);
        assert.equal(jsonCaptured.success, false);
    });

    await t.test("should return 403 if user role is 'user' (not admin)", () => {
        const req = {
            user: { _id: "user123", role: "user" },
        };
        let codeCaptured = null;
        let jsonCaptured = null;

        const res = {
            status: function (code) {
                codeCaptured = code;
                return this;
            },
            json: function (data) {
                jsonCaptured = data;
            },
        };
        adminMiddleware(req, res, () => assert.fail("Should not call next()"));
        assert.equal(codeCaptured, 403);
        assert.equal(jsonCaptured.success, false);
        assert.match(jsonCaptured.message, /Forbidden/i);
    });

    await t.test("should call next() if user role is 'admin'", () => {
        const req = {
            user: { _id: "admin123", role: "admin" },
        };
        let nextCalled = false;
        const res = {};
        adminMiddleware(req, res, () => {
            nextCalled = true;
        });
        assert.equal(nextCalled, true, "next() called successfully");
    });
});

test("Controller Validations and Security", async (t) => {
    await t.test("createProduct: reject missing required fields with 400", async () => {
        const req = {
            body: { name: "Incomplete" }, // missing price, stock, sku, description
            user: { _id: new mongoose.Types.ObjectId() },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await createProduct(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.message, /Please provide all required fields/i);
    });

    await t.test("createProduct: reject negative price or invalid stock with 400", async () => {
        const req = {
            body: {
                name: "Product Test",
                description: "Test description",
                price: -100,
                stock: 10,
                sku: "SKU-TEST-99",
            },
            user: { _id: new mongoose.Types.ObjectId() },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await createProduct(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.message, /Price must be a valid non-negative number/i);
    });

    await t.test("updateProduct: reject invalid MongoDB ID format with 400", async () => {
        const req = {
            params: { id: "invalid-id-format-123" },
            body: { name: "New Name" },
            user: { _id: new mongoose.Types.ObjectId() },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await updateProduct(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.message, /Invalid product ID format/i);
    });

    await t.test("updateProductStatus: reject missing isActive with 400", async () => {
        const req = {
            params: { id: new mongoose.Types.ObjectId().toString() },
            body: {},
            user: { _id: new mongoose.Types.ObjectId() },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await updateProductStatus(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.message, /isActive/i);
    });

    await t.test("getProductById: reject invalid MongoDB ID with 400", async () => {
        const req = {
            params: { id: "not-a-valid-object-id" },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await getProductById(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.message, /Invalid product ID format/i);
    });
});

test("JWT Token Verification in authMiddleware", async (t) => {
    await t.test("should reject request with no token with 401", async () => {
        const req = { headers: {} };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await authMiddleware(req, res, () => {});
        assert.equal(statusCode, 401);
        assert.equal(responseJson.status, false);
        assert.match(responseJson.message, /Access denied/i);
    });

    await t.test("should reject request with invalid JWT with 401", async () => {
        const req = {
            headers: {
                authorization: "Bearer invalid.fake.token",
            },
        };
        let statusCode = null;
        let responseJson = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    },
                };
            },
        };

        await authMiddleware(req, res, () => {});
        assert.equal(statusCode, 401);
        assert.equal(responseJson.status, false);
        assert.match(responseJson.message, /Invalid or expired token/i);
    });
});
