import jwt from "jsonwebtoken";
import user from "../model/usermodel.js";

// Helper to get cookie even if cookie-parser is not configured
const getCookie = (req, name) => {
    if (req.cookies && req.cookies[name]) {
        return req.cookies[name];
    }
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }
    return null;
};

const authMiddleware = async (req, res, next) => {
    try {
        let token;

        // 1. Check Authorization header (Bearer <token>)
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        // 2. Check direct 'token' header
        else if (req.headers["token"]) {
            token = req.headers["token"];
        }
        // 3. Check cookies
        else {
            token = getCookie(req, "token");
        }

        if (!token) {
            return res.status(401).json({
                status: false,
                message: "Access denied. Token not provided",
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "mysecretkeyecommerce123");

        // Fetch user from DB (excluding password)
        const currentUser = await user.findById(decoded.id).select("-password");
        if (!currentUser) {
            return res.status(404).json({
                status: false,
                message: "User not found with this token",
            });
        }

        // Check if user has logged out or session expired
        if (currentUser.token !== undefined && currentUser.token !== token) {
            return res.status(401).json({
                status: false,
                message: "Session expired or logged out. Please login again",
            });
        }

        req.user = currentUser;
        req.token = token;
        next();
    } catch (error) {
        return res.status(401).json({
            status: false,
            message: "Invalid or expired token",
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            status: false,
            message: "Authentication required. Please log in.",
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            status: false,
            message: "Forbidden: Admin access required for this action.",
        });
    }

    next();
};

export default authMiddleware;
export { authMiddleware, adminMiddleware };

