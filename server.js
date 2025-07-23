require('dotenv').config();
const express = require('express'); // <== This must come BEFORE using express()
const multer = require("multer");
const cors = require('cors');
const fs = require("fs/promises");
const path = require("path");
const { Pool } = require('pg');
const { generateToken } = require('./src/utils/authorization');
const { authenticate } = require('./src/utils/authorization/authenticate');
const { stat } = require('fs');
const { type } = require('os');
const assert = require('assert');

const app = express(); // ✅ Use express only after importing


const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || 'sap_service',
    password: process.env.DB_PASSWORD || "12345678",
    port: process.env.DB_PORT || 5432,
});


const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['POST', 'GET', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());


app.get('/api-health', async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'my backend is working good ',
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
})





//routes end --
//server listening
const PORT = process.env.PORT || 7070;

// // **Start Server**
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = { app, pool }