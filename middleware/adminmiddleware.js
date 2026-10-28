/**
 * Middleware to restrict route access to users with the 'admin' role.
 * Must be executed AFTER authMiddleware so that req.user is populated.
 */
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

export default adminMiddleware;
export { adminMiddleware };
