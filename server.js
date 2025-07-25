require('dotenv').config();
// const express = require('express'); // <== This must come BEFORE using express()
const multer = require("multer");
// const cors = require('cors');
const fs = require("fs/promises");
const path = require("path");
const { Pool } = require('pg');
const { generateToken } = require('./src/utils/authorization');
const { authenticate } = require('./src/utils/authorization/authenticate');
const { stat } = require('fs');
const { type } = require('os');
const assert = require('assert');
const { text } = require('stream/consumers');

const express = require('express');
const cors = require('cors');
const app = express(); // ✅ THIS MUST COME BEFORE app.use()
app.use(express.json({ limit: '100kb' }));


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

    const { services_name, description, status, api_url, api_key, method, request_payload } = req.body;
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'No data provided' });
    }

    if (!services_name || !description || status === undefined || !api_url || !method) {
        return res.status(400).json({ message: 'All fields are required' })
    }

    // if (!request_payload === 'GET'){
    //     return res.status(400).json({
    //         message: 'payload is recquired for this ony  POST , PUT , PATCH and DELETE '})
    // }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !request_payload) {
        return res.status(400).json({
            message: 'Payload is required for POST, PUT, PATCH, and DELETE methods'
        });
    }


    if (typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Status must be a boolean value' });
    }
    const allowedfields = ['services_name', 'description', 'status', 'api_url', 'api_key', 'method', 'request_payload'];

    const fields = Object.keys(req.body);
    const notAllowedFields = fields.filter(field => !allowedfields.includes(field));
    if (notAllowedFields.length > 0) {
        return res.status(400).json({ message: `Invalid fields: ${notAllowedFields.join(', ')}` });
    }


    const trimmedServiceName = services_name.trim();
    const trimmedDescription = description.trim();
    const trimmedApiUrl = api_url.trim();
    const trimmedApiKey = api_key.trim();
    const trimmedMethod = method.trim();
    const trimmedRequestPayload = JSON.stringify(request_payload); // optional if not already a string



    const isValidUrl = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i.test(trimmedApiUrl);
    if (!isValidUrl) {
        return res.status(400).json({ message: 'Invalid API URL format' });
    }


    try {
        const query = {
            text: `INSERT INTO servicess_menagment (
    services_name, description, status, api_url, api_key, request_payload, method
  ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            values: [
                trimmedServiceName,
                trimmedDescription,
                status,
                trimmedApiUrl,
                trimmedApiKey,
                request_payload, // or JSON.stringify(request_payload) if needed
                trimmedMethod,
            ],
        };
        const result = await pool.query(query);
        console.log("query", query)
        console.log("result", result)
        if (result.rows.length > 0) {
            return res.status(200).json({
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

});

app.get('/get-services', async (req, res) => {
    try {
        const query = {
            text: `SELECT * FROM servicess_menagment WHERE is_deleted = FALSE`
        };

        const result = await pool.query(query);


        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
            message: result.rows.length > 0
                ? 'Services fetched successfully'
                : 'No services found'
        });

    } catch (error) {
        console.error('Server error in /get-services:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching services',
            error: error.message
        });
    }
});





//routes end --
//server listening
const PORT = process.env.PORT || 7070;

// // **Start Server**
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = { app, pool };
