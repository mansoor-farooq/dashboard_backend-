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
const { text } = require('stream/consumers');

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
});


app.post('/add-services', async (req, res) => {

    const { services_name, description, status, api_url } = req.body;
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'No data provided' });
    }

    if (!services_name || !description || status === undefined || !api_url) {
        return res.status(400).json({ message: 'All fields are required' })
    }
    if (typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Status must be a boolean value' });
    }
    const allowedfields = ['services_name', 'description', 'status', 'api_url'];
    const fields = Object.keys(req.body);
    const notAllowedFields = fields.filter(field => !allowedfields.includes(field));
    if (notAllowedFields.length > 0) {
        return res.status(400).json({ message: `Invalid fields: ${notAllowedFields.join(', ')}` });
    }


    const trimmedServiceName = services_name.trim();
    const trimmedDescription = description.trim();
    const trimmedApiUrl = api_url.trim();

    const isValidUrl = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i.test(trimmedApiUrl);
    if (!isValidUrl) {
        return res.status(400).json({ message: 'Invalid API URL format' });
    }

    try {
        const query = {
            text: `INSERT INTO public.services_management (services_name, description, status, api_url) VALUES ($1, $2, $3, $4) RETURNING *`,
            values: [trimmedServiceName, trimmedDescription, status, trimmedApiUrl],
        }
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            return res.status(201).json({
                message: 'Service added successfully',
                service: result.rows[0]
            });
        } else {
            return res.status(400).json({ message: 'Failed to add service' });
        }

    } catch (error) {
        console.error('Sever error:', error);
        return res.status(500).json({ message: 'Internal server error in product added', error: error.message });
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