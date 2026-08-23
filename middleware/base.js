export const clientIp = (req, res, next) => next();
export const cookies = (req, res, next) => next();
export const cors = (req, res, next) => next();
export const errorHandler = (err, req, res, next) => res.status(500).json({ error: err.message });
export const notFoundHandler = (req, res) => res.status(404).json({ error: 'Not Found' });
export const sameOriginOnly = (req, res, next) => next();
export const securityHeaders = (req, res, next) => next();
