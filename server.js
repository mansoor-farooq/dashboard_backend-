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
const { count } = require('console');
const app = express(); // ✅ THIS MUST COME BEFORE app.use()
// app.use(express.json({ limit: '10mb' }));

const axios = require("axios");



const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || 'sap_service',
    password: process.env.DB_PASSWORD || "12345678",
    port: process.env.DB_PORT || 5432,
});

const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    // origin: process.env.CORS_ORIGIN || 'http://192.168.1.239:5173/',


    methods: ['POST', 'GET', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
};


app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));



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
    const { services_name, description, status, api_url, api_key, method, request_payload, auth, sorce_name } = req.body;
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'No data provided' });
    }

    const trimmedApiUrl = api_url?.trim();
    const isRelativeUrl = trimmedApiUrl.startsWith('/');
    const isAbsoluteUrl = /^https?:\/\//i.test(trimmedApiUrl);

    if (!isRelativeUrl && !isAbsoluteUrl) {
        return res.status(400).json({
            message: 'Invalid API URL format. Must start with http://, https://, or /'
        });
    }

    if (!services_name || !description || status === undefined || !api_url || !method || !sorce_name) {
        return res.status(400).json({ message: 'All fields are required' })
    }


    if (!sorce_name) {
        return res.status(400).json({ message: 'Source name is required' });
    }

    if (auth && (typeof auth !== 'object' || Array.isArray(auth))) {
        return res.status(400).json({ message: 'Auth must be a valid JSON object' });
    }

    if (method !== 'GET' && !request_payload) {
        return res.status(400).json({
            message: 'Payload is required for POST, PUT, PATCH, and DELETE methods'
        });
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !request_payload) {
        return res.status(400).json({
            message: 'Payload is required for POST, PUT, PATCH, and DELETE methods'
        });
    }
    if (typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Status must be a boolean value' });
    }
    const allowedfields = ['services_name', 'description', 'status', 'api_url', 'api_key', 'method', 'request_payload', 'auth', 'sorce_name'];
    const fields = Object.keys(req.body);
    const notAllowedFields = fields.filter(field => !allowedfields.includes(field));
    if (notAllowedFields.length > 0) {
        return res.status(400).json({ message: `Invalid fields: ${notAllowedFields.join(', ')}` });
    }
    const trimmedServiceName = services_name.trim();
    const trimmedDescription = description.trim();
    // const trimmedApiUrl = api_url.trim();
    const trimmedApiKey = api_key ? api_key.trim() : null;

    const trimmedMethod = method.trim();
    const trimedAuth = auth && typeof auth === 'object' ? auth : null;

    const trimmedRequestPayload = JSON.stringify(request_payload); // optional if not already a string
    const trimmedSourceName = sorce_name.trim();

    const already_exist_name = `select * from servicess_menagment WHERE services_name = $1`;
    const already_exist_url = `select * from servicess_menagment WHERE api_url = $1`;
    console.log("alname", already_exist_name)
    console.log("already_exist_url", already_exist_url);
    const [already_exist_name_result, alread_exist_url_result] = await Promise.all([
        pool.query(already_exist_name, [trimmedServiceName]),
        pool.query(already_exist_url, [trimmedApiUrl])
    ]);
    if (already_exist_name_result.rows.length > 0) {
        return res.status(400).json({ message: "Service name already exists" });
    }
    if (alread_exist_url_result.rows.length > 0) {
        return res.status(400).json({ message: "Service URL Already Exists" });
    }
    console.log("exist url", alread_exist_url_result)
    console.log("exist url", already_exist_name_result)
    try {
        const query = {
            text: `INSERT INTO servicess_menagment (
    services_name, description, status, api_url, api_key, request_payload, method ,auth ,source_name
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8 ,$9) RETURNING *`,
            values: [
                trimmedServiceName,
                trimmedDescription,
                status,
                trimmedApiUrl,
                trimmedApiKey,
                request_payload, // or JSON.stringify(request_payload) if needed
                trimmedMethod,
                trimedAuth,
                trimmedSourceName
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
            text: `SELECT * FROM servicess_menagment 
WHERE is_deleted = FALSE 
ORDER BY created_at DESC;
`
            // text: `SELECT * FROM servicess_menagment WHERE is_deleted = FALSE`
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



// ✅ Proxy route
app.post("/proxy", async (req, res) => {
    const { url, method = "GET", payload = null, auth = null, headers = {} } = req.body;
    const started = Date.now();

    try {
        if (!url || !/^https?:\/\//i.test(url)) {
            return res.status(400).json({ message: "Invalid or missing URL" });
        }

        const config = {
            url,
            method: method.toUpperCase(),
            timeout: 20000,
            headers,
            validateStatus: () => true,
        };

        if (payload && ["POST", "PUT", "PATCH", "DELETE"].includes(config.method)) {
            config.data = payload;
        }

        if (auth?.username && auth?.password) {
            config.auth = { username: auth.username, password: auth.password };
        }

        const response = await axios(config);

        // return res.status(response.status).json({
        //     message: response.status >= 400 ? (response.data?.message || "Upstream error") : "OK",
        //     duration_ms: Date.now() - started,
        //     data: response.data,
        // });
        return res.status(200).json({
            upstream_status: response.status,
            message: response.status >= 400 ? (response.data?.message || "Upstream error") : "OK",
            duration_ms: Date.now() - started,
            data: response.data,
        });


    } catch (error) {
        return res.status(500).json({
            message: error.message || "Proxy error",
            duration_ms: Date.now() - started,
        });
    }
});


// const { services_name, description, method } = req.query;
// const services_name = req.query.services_name;
// const description = req.query.description;
// const method = req.query.method;

//  this is working but this use for large data or large app 
// app.get('/search-services', async (req, res) => {
//     console.log("Query Received:", req.query);

//     try {
//         let { services_name, method } = req.query;

//         // Normalize method to uppercase if it exists
//         if (method) method = method.toUpperCase();

//         let result;

//         if (services_name && !method) {
//             console.log("Searching by services_name only...");
//             result = await pool.query(
//                 'SELECT * FROM servicess_menagment WHERE services_name ILIKE $1 AND is_deleted = FALSE',
//                 [`%${services_name}%`]
//             );
//         } else if (!services_name && method) {
//             console.log("Searching by method only...");
//             result = await pool.query(
//                 'SELECT * FROM servicess_menagment WHERE method = $1 AND is_deleted = FALSE',
//                 [method]
//             );
//         } else if (services_name && method) {
//             console.log("Searching by services_name and method...");
//             result = await pool.query(
//                 'SELECT * FROM servicess_menagment WHERE services_name ILIKE $1 AND method = $2 AND is_deleted = FALSE',
//                 [`%${services_name}%`, method]
//             );
//         } else {
//             console.log("No filters applied, returning all...");
//             result = await pool.query(
//                 'SELECT * FROM servicess_menagment WHERE is_deleted = FALSE'
//             );
//         }

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             data: result.rows,
//             message: result.rows.length > 0 ? 'Services fetched successfully' : 'No services found',
//         });

//     } catch (error) {
//         console.error('Search error:', error); // Full error object
//         return res.status(500).json({ success: false, message: 'Server error' });
//     }
// });






//routes end --
//server listening
// const PORT = process.env.PORT || 7070;
// // // **Start Server**
// app.listen(PORT, () => {
//     console.log(`✅ Server running on port ${PORT}`);
// });

const PORT = process.env.PORT || 7070;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = { app, pool };
