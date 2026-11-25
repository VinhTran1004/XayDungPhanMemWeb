// Entrypoint gốc để Vercel chạy Backend Express dưới dạng Serverless Function cho mọi route /api/*
const app = require('../backend/server');

module.exports = app;
