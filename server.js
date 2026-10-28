import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import registerRouter from "./router/registerrouter.js";
import productRouter from "./router/productrouter.js";

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration (enables requests from Web browsers, Flutter web, etc.)
app.use(
    cors({
        origin: true, // Dynamically reflects request origin to support all origins with credentials
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
            "Origin",
            "X-Requested-With",
            "Content-Type",
            "Accept",
            "Authorization",
            "token",
        ],
    })
);

// Middleware to parse cookies
app.use(cookieParser());

// Trim whitespaces/newlines from incoming URLs (prevents %0A errors)
app.use((req, res, next) => {
    req.url = decodeURI(req.url).trim().replace(/[\r\n]+$/, "");
    next();
});

// Middleware to parse JSON and Raw Text JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

// Fallback to parse JSON string if sent as text/plain
app.use((req, res, next) => {
    if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            // Ignore parse error
        }
    }
    next();
});

// Health check / root endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        status: true,
        message: "Ecommerce Backend API is running smoothly",
    });
});

// Routes
app.use("/api", registerRouter);
// Fallback alias in case client URL contains typo '/apl' instead of '/api'
app.use("/apl", registerRouter);

app.use("/api/v1", productRouter);
app.use("/apl/v1", productRouter);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
