const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];

const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'Access denied. IP not allowed.' });
  }
  
  next();
};

module.exports = ipFilter;
