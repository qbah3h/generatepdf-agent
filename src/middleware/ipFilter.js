const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];

const ipFilter = (req, res, next) => {
  console.log('Request headers:', req.headers);
  const clientIP = req.ip || 
                   req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress;

  console.log('Detected client IP:', clientIP);
  console.log('Allowed IPs:', allowedIPs);
  
  if (!allowedIPs.includes(clientIP)) {
    console.log('Access denied for IP:', clientIP);
    return res.status(403).json({ 
      error: 'Access denied. IP not allowed.',
      detectedIP: clientIP,
      allowedIPs: allowedIPs
    });
  }
  
  console.log('Access granted for IP:', clientIP);
  next();
};

module.exports = ipFilter;
