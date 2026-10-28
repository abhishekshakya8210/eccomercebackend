import user from "../model/usermodel.js";
import jwt from "jsonwebtoken";

const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                status: false,
                message: "first fill all the fields",
            });
        }

        const existingUser = await user.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                status: false,
                message: "user already exists",
            });
        }

        const userregister = await user.create({
            name,
            email,
            password,
            role: role || "user",
        });

        if (userregister) {
            return res.status(200).json({
                status: true,
                message: "Acount created",
                user: {
                    _id: userregister._id,
                    name: userregister.name,
                    email: userregister.email,
                    role: userregister.role,
                },
            });
        } else {
            return res.status(400).json({
                status: false,
                message: "first fill all the fields",
            });
        }
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "internale server error",
        });
    }
};
// login 
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: false,
                message: "first fill all the fields",
            });
        }

        const existingUser = await user.findOne({ email });
        if (!existingUser) {
            return res.status(404).json({
                status: false,
                message: "user not found",
            });
        }

        if (existingUser.password !== password) {
            return res.status(400).json({
                status: false,
                message: "invalid credentials",
            });
        }

        // Generate JWT token (valid for 30 days)
        const token = jwt.sign(
            { id: existingUser._id, email: existingUser.email, role: existingUser.role },
            process.env.JWT_SECRET || "mysecretkeyecommerce123",
            { expiresIn: "30d" }
        );

        // Update token in database
        existingUser.token = token;
        await existingUser.save();

        // Set token cookie (30 days)
        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            status: true,
            message: "Login successful",

            user: {
                _id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email,
                role: existingUser.role,
                token,
            },
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "internale server error",
        });
    }
};

// get current profile
const getProfile = async (req, res) => {
    try {
        return res.status(200).json({
            status: true,
            message: "Profile fetched successfully",
            user: req.user,
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "internale server error",
        });
    }
};

// update profile

const updateProfile = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const id = req.params.id || req.user?._id;

        if (!id) {
            return res.status(400).json({
                status: false,
                message: "User ID is required",
            });
        }

        const currentUser = await user.findById(id);

        if (!currentUser) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        // Check duplicate email
        if (email && email !== currentUser.email) {
            const existingEmail = await user.findOne({ email, _id: { $ne: id } });

            if (existingEmail) {
                return res.status(400).json({
                    status: false,
                    message: "Email already in use",
                });
            }

            currentUser.email = email;
        }

        if (name !== undefined) {
            currentUser.name = name;
        }

        if (password) {
            currentUser.password = password;
        }

        if (role && ["user", "admin"].includes(role)) {
            currentUser.role = role;
        }

        await currentUser.save();

        return res.status(200).json({
            status: true,
            message: "Profile updated successfully",
            user: {
                _id: currentUser._id,
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role,
            },
        });

    } catch (e) {
        console.error("Update profile error:", e);

        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};

// logout
const logout = async (req, res) => {
    try {
        const userId = req.user?._id;

        // Clear stored token in database
        if (userId) {
            await user.findByIdAndUpdate(userId, { token: null });
        }

        // Clear token cookie
        res.clearCookie("token", {
            httpOnly: true,
            sameSite: "strict",
        });

        return res.status(200).json({
            status: true,
            message: "Logged out successfully",
        });
    } catch (e) {
        console.error("Logout error:", e);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};

export { register, login, getProfile, updateProfile, logout };
