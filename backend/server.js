const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Latitud 0 Backend is running' });
});

// Example route for Contact Form (to be implemented)
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    // TODO: Send email or save to DB
    console.log(`Received contact from ${name} (${email})`);
    res.status(200).json({ success: true, message: 'Mensaje recibido correctamente.' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
