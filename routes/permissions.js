const express = require('express');
const { body } = require('express-validator');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const { authenticate, authorize, logActivity } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/permissions
// @desc    Get all permissions
// @access  Private/Admin
router.get('/',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { category, isActive } = req.query;
      
      let query = {};
      if (category) query.category = category;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      const permissions = await Permission.find(query).sort('category name');

      res.json({
        success: true,
        data: { permissions }
      });

    } catch (error) {
      console.error('Get permissions error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch permissions'
      });
    }
  }
);

// @route   POST /api/permissions
// @desc    Create a new permission
// @access  Private/Admin
router.post('/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Permission name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('route').notEmpty().withMessage('Route is required'),
    body('method').isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).withMessage('Invalid method'),
    body('category').isIn(['products', 'orders', 'users', 'dashboard', 'settings', 'cart', 'profile']).withMessage('Invalid category'),
    handleValidationErrors
  ],
  logActivity('create_permission'),
  async (req, res) => {
    try {
      const { name, description, route, method, category, isActive } = req.body;

      const permission = new Permission({
        name,
        description,
        route,
        method,
        category,
        isActive
      });

      await permission.save();

      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: { permission }
      });

    } catch (error) {
      console.error('Create permission error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Duplicate Error',
          message: 'Permission name already exists'
        });
      }

      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to create permission'
      });
    }
  }
);

// @route   PUT /api/permissions/:id
// @desc    Update a permission
// @access  Private/Admin
router.put('/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().notEmpty().withMessage('Permission name cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('route').optional().notEmpty().withMessage('Route cannot be empty'),
    body('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).withMessage('Invalid method'),
    body('category').optional().isIn(['products', 'orders', 'users', 'dashboard', 'settings', 'cart', 'profile']).withMessage('Invalid category'),
    handleValidationErrors
  ],
  logActivity('update_permission'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const permission = await Permission.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!permission) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Permission not found'
        });
      }

      res.json({
        success: true,
        message: 'Permission updated successfully',
        data: { permission }
      });

    } catch (error) {
      console.error('Update permission error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to update permission'
      });
    }
  }
);

// @route   DELETE /api/permissions/:id
// @desc    Delete a permission
// @access  Private/Admin
router.delete('/:id',
  authenticate,
  authorize('admin'),
  logActivity('delete_permission'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const permission = await Permission.findByIdAndDelete(id);

      if (!permission) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Permission not found'
        });
      }

      res.json({
        success: true,
        message: 'Permission deleted successfully'
      });

    } catch (error) {
      console.error('Delete permission error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to delete permission'
      });
    }
  }
);

// @route   GET /api/permissions/roles
// @desc    Get all roles
// @access  Private/Admin
router.get('/roles',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const roles = await Role.find({ isActive: true }).sort('name');

      res.json({
        success: true,
        data: { roles }
      });

    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch roles'
      });
    }
  }
);

// @route   POST /api/permissions/roles
// @desc    Create a new role
// @access  Private/Admin
router.post('/roles',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Role name is required'),
    body('displayName').notEmpty().withMessage('Display name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
    handleValidationErrors
  ],
  logActivity('create_role'),
  async (req, res) => {
    try {
      const { name, displayName, description, permissions, isActive, isSystem } = req.body;

      const role = new Role({
        name,
        displayName,
        description,
        permissions,
        isActive,
        isSystem
      });

      await role.save();

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: { role }
      });

    } catch (error) {
      console.error('Create role error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          error: 'Duplicate Error',
          message: 'Role name already exists'
        });
      }

      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to create role'
      });
    }
  }
);

// @route   PUT /api/permissions/roles/:id
// @desc    Update a role
// @access  Private/Admin
router.put('/roles/:id',
  authenticate,
  authorize('admin'),
  [
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    handleValidationErrors
  ],
  logActivity('update_role'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if role is a system role
      const existingRole = await Role.findById(id);
      if (existingRole && existingRole.isSystem && updates.name) {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'Cannot modify name of system roles'
        });
      }

      const role = await Role.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!role) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Role not found'
        });
      }

      res.json({
        success: true,
        message: 'Role updated successfully',
        data: { role }
      });

    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to update role'
      });
    }
  }
);

// @route   DELETE /api/permissions/roles/:id
// @desc    Delete a role
// @access  Private/Admin
router.delete('/roles/:id',
  authenticate,
  authorize('admin'),
  logActivity('delete_role'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const role = await Role.findById(id);

      if (!role) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Role not found'
        });
      }

      if (role.isSystem) {
        return res.status(400).json({
          error: 'Action Not Allowed',
          message: 'Cannot delete system roles'
        });
      }

      await role.deleteOne();

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });

    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to delete role'
      });
    }
  }
);

module.exports = router;

