const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  sensitiveOperationLimit,
  logActivity
} = require('../middleware/auth');
const { body } = require('express-validator');
const {
  validateUserRegistration,
  validateUserLogin,
  validatePasswordChange,
  validateEmail,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', 
  validateUserRegistration,
  logActivity('user_registration'),
  async (req, res) => {
    try {
      const { name, email, password, phone } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          error: 'User Already Exists',
          message: 'A user with this email already exists'
        });
      }

      // Create new user
      const user = new User({
        name,
        email,
        password,
        phone,
        emailVerificationToken: crypto.randomBytes(32).toString('hex')
      });

      await user.save();

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Remove sensitive data from response
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.emailVerificationToken;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration Failed',
        message: 'Unable to register user. Please try again.'
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login',
  validateUserLogin,
  sensitiveOperationLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  logActivity('user_login'),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid Credentials',
          message: 'Invalid email or password'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          error: 'Account Locked',
          message: 'Account is temporarily locked due to too many failed login attempts'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          error: 'Account Suspended',
          message: 'Your account has been suspended'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          error: 'Invalid Credentials',
          message: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Remove sensitive data from response
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.loginAttempts;
      delete userResponse.lockUntil;
      delete userResponse.emailVerificationToken;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login Failed',
        message: 'Unable to login. Please try again.'
      });
    }
  }
);

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Token Required',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'User not found or inactive'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid Token',
      message: 'Unable to refresh token'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout',
  authenticate,
  logActivity('user_logout'),
  (req, res) => {
    // In a real application, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User profile not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch user profile'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password',
  authenticate,
  validatePasswordChange,
  sensitiveOperationLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  logActivity('password_change'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user._id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Invalid Password',
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Password Change Failed',
        message: 'Unable to change password. Please try again.'
      });
    }
  }
);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password',
  validateEmail,
  sensitiveOperationLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  logActivity('password_reset_request'),
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to user
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetTokenExpiry;
      await user.save();

      // In a real application, you would send an email here
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        error: 'Request Failed',
        message: 'Unable to process password reset request'
      });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password',
  [
    validateEmail,
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors
  ],
  sensitiveOperationLimit(5, 60 * 60 * 1000), // 5 attempts per hour
  logActivity('password_reset'),
  async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;

      // Find user with valid reset token
      const user = await User.findOne({
        email,
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Password reset token is invalid or has expired'
        });
      }

      // Update password and clear reset token
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Password has been reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        error: 'Reset Failed',
        message: 'Unable to reset password. Please try again.'
      });
    }
  }
);

// @route   POST /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.post('/verify-email',
  [
    validateEmail,
    body('token').notEmpty().withMessage('Verification token is required'),
    handleValidationErrors
  ],
  logActivity('email_verification'),
  async (req, res) => {
    try {
      const { email, token } = req.body;

      const user = await User.findOne({
        email,
        emailVerificationToken: token
      }).select('+emailVerificationToken');

      if (!user) {
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Email verification token is invalid'
        });
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        error: 'Verification Failed',
        message: 'Unable to verify email. Please try again.'
      });
    }
  }
);

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification
// @access  Private
router.post('/resend-verification',
  authenticate,
  sensitiveOperationLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  logActivity('resend_verification'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (user.isEmailVerified) {
        return res.status(400).json({
          error: 'Already Verified',
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      await user.save();

      // In a real application, you would send an email here
      console.log(`Email verification token for ${user.email}: ${user.emailVerificationToken}`);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        error: 'Request Failed',
        message: 'Unable to resend verification email'
      });
    }
  }
);

module.exports = router;
