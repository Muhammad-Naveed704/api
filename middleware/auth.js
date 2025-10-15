const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account Suspended',
        message: 'Your account has been suspended'
      });
    }

    if (user.isLocked) {
      return res.status(401).json({
        error: 'Account Locked',
        message: 'Your account is temporarily locked due to multiple failed login attempts'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'Token is malformed'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Please login again'
      });
    }
    
    res.status(500).json({
      error: 'Server Error',
      message: 'Authentication failed'
    });
  }
};

// Check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check if user has specific permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'Authentication required'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the specific permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

// Check if user has any of the specified permissions
const checkAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'Authentication required'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has any of the specified permissions
    const hasPermission = permissions.some(permission => 
      req.user.permissions && req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

// Check if user owns the resource or is admin
const checkOwnership = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'Authentication required'
      });
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // For new resources, user owns it by default
    if (req.method === 'POST') {
      return next();
    }

    // For existing resources, check ownership
    const resourceUserId = req.resource?.[resourceUserField] || req.params.userId;
    
    if (!resourceUserId || resourceUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    if (attempts.has(key)) {
      attempts.set(key, attempts.get(key).filter(time => time > windowStart));
    }

    const userAttempts = attempts.get(key) || [];
    
    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({
        error: 'Too Many Attempts',
        message: 'Too many attempts, please try again later'
      });
    }

    // Record this attempt
    userAttempts.push(now);
    attempts.set(key, userAttempts);

    next();
  };
};

// Middleware to check if email is verified
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Access Denied',
      message: 'Authentication required'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      error: 'Email Verification Required',
      message: 'Please verify your email address to continue'
    });
  }

  next();
};

// Generate JWT token
const generateToken = (userId, expiresIn = '7d') => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Middleware to log user activity
const logActivity = (action) => {
  return (req, res, next) => {
    // Store activity info for later logging
    req.activity = {
      action,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    };
    
    // Log after response is sent
    res.on('finish', () => {
      if (req.user) {
        console.log(`User Activity: ${req.user.email} - ${action} - ${res.statusCode} - ${req.ip}`);
        
        // Here you could save to database or external logging service
        // ActivityLog.create({
        //   user: req.user._id,
        //   action,
        //   ip: req.ip,
        //   userAgent: req.get('User-Agent'),
        //   statusCode: res.statusCode,
        //   timestamp: new Date()
        // });
      }
    });
    
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  checkPermission,
  checkAnyPermission,
  optionalAuth,
  checkOwnership,
  sensitiveOperationLimit,
  requireEmailVerification,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  logActivity
};
