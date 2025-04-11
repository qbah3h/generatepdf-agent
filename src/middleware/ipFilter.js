require('dotenv').config();
const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];

const normalizeIP = (ip) => {
  // Remove the IPv6 prefix if present
  return ip.replace(/^::ffff:/, '');
};

const ipFilter = (req, res, next) => {
  console.log('Request headers:', req.headers);
  const rawClientIP = req.ip || 
                      req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress;

  const clientIP = normalizeIP(rawClientIP);
  // console.log('Raw client IP:', rawClientIP);
  // console.log('Normalized client IP:', clientIP);
  // console.log('Allowed IPs:', allowedIPs);
  
  if (!allowedIPs.includes(clientIP)) {
    console.log('Access denied for IP:', clientIP);
    return res.status(403).json({ 
      error: 'Access denied. IP not allowed.',
      detectedIP: clientIP,
      rawIP: rawClientIP,
      allowedIPs: allowedIPs
    });
  }
  
  console.log('Access granted for IP:', clientIP);
  next();
};

module.exports = ipFilter;
