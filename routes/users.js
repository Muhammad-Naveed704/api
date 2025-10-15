const express = require('express');
const crypto = require('crypto');
const { body } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize, checkOwnership, logActivity } = require('../middleware/auth');
const {
  validateUserUpdate,
  validateObjectId,
  validatePagination,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/',
  authenticate,
  authorize('admin'),
  validatePagination,
  logActivity('view_all_users'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sort = '-createdAt',
        search,
        role,
        isActive,
        isEmailVerified
      } = req.query;

      // Build query
      let query = {};
      
      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Filter by role
      if (role) {
        query.role = role;
      }
      
      // Filter by active status
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      // Filter by email verification status
      if (isEmailVerified !== undefined) {
        query.isEmailVerified = isEmailVerified === 'true';
      }

      // Execute query with pagination
      const users = await User.find(query)
        .select('-password -emailVerificationToken -passwordResetToken')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Get total count for pagination
      const total = await User.countDocuments(query);
      
      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers: total,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch users'
      });
    }
  }
);

// @route   GET /api/users/stats
// @desc    Get user statistics (Admin only)
// @access  Private/Admin
router.get('/stats',
  authenticate,
  authorize('admin'),
  logActivity('view_user_stats'),
  async (req, res) => {
    try {
      const stats = await User.getStats();
      
      res.json({
        success: true,
        data: { stats }
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch user statistics'
      });
    }
  }
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Own profile or Admin)
router.get('/:id',
  authenticate,
  validateObjectId('id'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is accessing their own profile or is admin
      if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only access your own profile'
        });
      }

      const user = await User.findById(id)
        .select('-password -emailVerificationToken -passwordResetToken');
      
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch user'
      });
    }
  }
);

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private (Own profile or Admin)
router.put('/:id',
  authenticate,
  validateObjectId('id'),
  validateUserUpdate,
  logActivity('update_user_profile'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is updating their own profile or is admin
      if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own profile'
        });
      }

      const updates = req.body;
      
      // Prevent non-admin users from changing certain fields
      if (req.user.role !== 'admin') {
        delete updates.role;
        delete updates.isActive;
        delete updates.isEmailVerified;
      }

      // If email is being changed, require re-verification
      if (updates.email && updates.email !== req.user.email) {
        updates.isEmailVerified = false;
        updates.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      }

      const user = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });

    } catch (error) {
      console.error('Update user error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Duplicate Error',
          message: 'Email already exists'
        });
      }
      
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update profile'
      });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only or own account)
// @access  Private
router.delete('/:id',
  authenticate,
  validateObjectId('id'),
  logActivity('delete_user'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is deleting their own account or is admin
      if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own account'
        });
      }

      // Prevent admin from deleting themselves
      if (req.user._id.toString() === id && req.user.role === 'admin') {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'Admin users cannot delete their own account'
        });
      }

      const user = await User.findByIdAndDelete(id);
      
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        error: 'Delete Failed',
        message: 'Unable to delete user'
      });
    }
  }
);

// @route   PUT /api/users/:id/activate
// @desc    Activate/Deactivate user (Admin only)
// @access  Private/Admin
router.put('/:id/activate',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  [
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors
  ],
  logActivity('toggle_user_activation'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Prevent admin from deactivating themselves
      if (req.user._id.toString() === id && !isActive) {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'Admin users cannot deactivate their own account'
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
      ).select('-password -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { user }
      });

    } catch (error) {
      console.error('Toggle user activation error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update user status'
      });
    }
  }
);

// @route   PUT /api/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private/Admin
router.put('/:id/role',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  [
    body('role')
      .isIn(['user', 'admin', 'moderator'])
      .withMessage('Role must be user, admin, or moderator'),
    handleValidationErrors
  ],
  logActivity('update_user_role'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Prevent admin from changing their own role
      if (req.user._id.toString() === id) {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'You cannot change your own role'
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { role },
        { new: true }
      ).select('-password -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: { user }
      });

    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update user role'
      });
    }
  }
);

// @route   PUT /api/users/:id/permissions
// @desc    Update user permissions (Admin only)
// @access  Private/Admin
router.put('/:id/permissions',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  [
    body('permissions')
      .isArray()
      .withMessage('Permissions must be an array'),
    handleValidationErrors
  ],
  logActivity('update_user_permissions'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      // Prevent admin from changing their own permissions
      if (req.user._id.toString() === id) {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'You cannot change your own permissions'
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { permissions },
        { new: true }
      ).select('-password -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User permissions updated successfully',
        data: { user }
      });

    } catch (error) {
      console.error('Update user permissions error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update user permissions'
      });
    }
  }
);

// @route   POST /api/users/create
// @desc    Create a new user (Admin only)
// @access  Private/Admin
router.post('/create',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['user', 'admin', 'moderator']).withMessage('Invalid role'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    handleValidationErrors
  ],
  logActivity('create_user'),
  async (req, res) => {
    try {
      const { name, email, password, role, permissions, phone } = req.body;

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
        role: role || 'user',
        permissions: permissions || [],
        phone,
        isEmailVerified: true // Admin-created users are auto-verified
      });

      await user.save();

      // Remove sensitive data from response
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: userResponse }
      });

    } catch (error) {
      console.error('Create user error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Duplicate Error',
          message: 'Email already exists'
        });
      }

      res.status(500).json({
        error: 'Create Failed',
        message: 'Unable to create user'
      });
    }
  }
);

// @route   POST /api/users/:id/unlock
// @desc    Unlock user account (Admin only)
// @access  Private/Admin
router.post('/:id/unlock',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  logActivity('unlock_user_account'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      // Reset login attempts and unlock account
      await user.resetLoginAttempts();

      res.json({
        success: true,
        message: 'User account unlocked successfully'
      });

    } catch (error) {
      console.error('Unlock user error:', error);
      res.status(500).json({
        error: 'Unlock Failed',
        message: 'Unable to unlock user account'
      });
    }
  }
);

// @route   GET /api/users/:id/activity
// @desc    Get user activity log (Admin only or own activity)
// @access  Private
router.get('/:id/activity',
  authenticate,
  validateObjectId('id'),
  validatePagination,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is accessing their own activity or is admin
      if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only access your own activity'
        });
      }

      // In a real application, you would have an ActivityLog model
      // For now, we'll return a placeholder response
      const activities = [
        {
          action: 'login',
          timestamp: new Date(),
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...'
        }
      ];

      res.json({
        success: true,
        data: { activities }
      });

    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch user activity'
      });
    }
  }
);

module.exports = router;
