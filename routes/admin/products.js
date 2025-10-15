const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const Product = require('../../models/Product');
const { authenticate, authorize, logActivity } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../middleware/validation');

const router = express.Router();


// Configure multer for multiple image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/products';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation rules for product creation
const createProductValidation = [
  body('name').notEmpty().withMessage('Product name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Name must be between 2-200 characters'),
  body('description').notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('colour').notEmpty().withMessage('Colour is required'),
  body('size').isIn(['sm', 'md', 'lg', 'xl']).withMessage('Size must be sm, md, lg, or xl'),
  body('totalStock').isInt({ min: 0 }).withMessage('Total stock must be a non-negative integer'),
  body('category').notEmpty().withMessage('Category is required'),
  // Skip tags validation here since FormData sends it as string
  handleValidationErrors
];

// Validation rules for product update
const updateProductValidation = [
  body('name').optional().isLength({ min: 2, max: 200 }).withMessage('Name must be between 2-200 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('colour').optional().notEmpty().withMessage('Colour cannot be empty'),
  body('size').optional().isIn(['sm', 'md', 'lg', 'xl']).withMessage('Size must be sm, md, lg, or xl'),
  body('totalStock').optional().isInt({ min: 0 }).withMessage('Total stock must be a non-negative integer'),
  // Skip tags validation here since FormData sends it as string
  handleValidationErrors
];

// @route   GET /api/admin/products
// @desc    Get all products for admin with advanced filtering
// @access  Private/Admin
router.get('/',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 12,
        sort = '-createdAt',
        search,
        category,
        colour,
        size,
        inStock,
        featured,
        minPrice,
        maxPrice
      } = req.query;

      let query = {};
      
      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Filters
      if (category) query.category = category;
      if (colour) query.colour = colour;
      if (size) query.size = size;
      if (inStock !== undefined) query.inStock = inStock === 'true';
      if (featured !== undefined) query.isFeatured = featured === 'true';
      
      // Price range
      if (minPrice !== undefined || maxPrice !== undefined) {
        query.price = {};
        if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
        if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
      }

      // Sorting logic
      let sortQuery = {};
      switch (sort) {
        case 'name':
          sortQuery = { name: 1 };
          break;
        case '-name':
          sortQuery = { name: -1 };
          break;
        case 'price':
          sortQuery = { price: 1 };
          break;
        case '-price':
          sortQuery = { price: -1 };
          break;
        case 'stock':
          sortQuery = { totalStock: 1 };
          break;
        case '-stock':
          sortQuery = { totalStock: -1 };
          break;
        case 'sold':
          sortQuery = { soldCount: 1 };
          break;
        case '-sold':
          sortQuery = { soldCount: -1 };
          break;
        default:
          sortQuery = { createdAt: -1 };
      }

      const products = await Product.find(query)
        .populate('createdBy', 'name email')
        .sort(sortQuery)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Product.countDocuments(query);
      
      res.json({
        success: true,
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('❌ Get admin products error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch products',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/admin/products/:id
// @desc    Get single product for admin
// @access  Private/Admin
router.get('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id)
        .populate('createdBy', 'name email');

      if (!product) {
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: { product }
      });

    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch product'
      });
    }
  }
);


router.post('/',
  authenticate,
  authorize('admin'),
  upload.array('images', 10), // Allow up to 10 images
  createProductValidation,
  logActivity('create_product'),
  async (req, res) => {
    try {
      const productData = { ...req.body };
      
      // Parse tags if it's a string
      if (typeof productData.tags === 'string') {
        try {
          // Try to parse as JSON first
          productData.tags = JSON.parse(productData.tags);
        } catch (e) {
          // If JSON parsing fails, split by comma
          productData.tags = productData.tags.split(',').map(tag => tag.trim().toLowerCase());
        }
      }
      
      // Ensure tags is an array and clean it up
      if (!Array.isArray(productData.tags)) {
        productData.tags = [];
      }
      
      // Clean and normalize tags
      productData.tags = productData.tags
        .filter(tag => tag && tag.trim())
        .map(tag => tag.trim().toLowerCase());

      // Handle uploaded images
      if (req.files && req.files.length > 0) {
        productData.images = req.files.map(file => `/uploads/products/${file.filename}`);
      } else {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'At least one product image is required'
        });
      }

      // Set creator
      productData.createdBy = req.user._id;

      // Auto-generate slug if not provided
      if (!productData.slug) {
        productData.slug = productData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      const product = new Product(productData);
      await product.save();

      await product.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product }
      });

    } catch (error) {
      console.error('Create product error:', error);
      
      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          error: 'Duplicate Error',
          message: `${field} already exists. Please use a different ${field}.`
        });
      }
      
      res.status(500).json({
        error: 'Creation Failed',
        message: 'Unable to create product'
      });
    }
  }
);


router.put('/:id',
  authenticate,
  authorize('admin'),
  upload.array('images', 10),
  updateProductValidation,
  logActivity('update_product'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };

      // Parse tags if it's a string
      if (typeof updates.tags === 'string') {
        try {
          // Try to parse as JSON first
          updates.tags = JSON.parse(updates.tags);
        } catch (e) {
          // If JSON parsing fails, split by comma
          updates.tags = updates.tags.split(',').map(tag => tag.trim().toLowerCase());
        }
      }
      
      // Ensure tags is an array and clean it up
      if (updates.tags && !Array.isArray(updates.tags)) {
        updates.tags = [];
      }
      
      // Clean and normalize tags
      if (updates.tags) {
        updates.tags = updates.tags
          .filter(tag => tag && tag.trim())
          .map(tag => tag.trim().toLowerCase());
      }

      // Handle new uploaded images
      if (req.files && req.files.length > 0) {
        const oldProduct = await Product.findById(id);
        
        // Delete old images
        if (oldProduct && oldProduct.images) {
          oldProduct.images.forEach(imagePath => {
            const fullPath = path.join(__dirname, '../..', imagePath);
            fs.unlink(fullPath, (err) => {
              if (err) console.error('Error deleting old image:', err);
            });
          });
        }
        
        // Set new images
        updates.images = req.files.map(file => `/uploads/products/${file.filename}`);
      }

      // Update slug if name is changed
      if (updates.name) {
        updates.slug = updates.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      const product = await Product.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      if (!product) {
        // Clean up uploaded files if product not found
        if (req.files) {
          req.files.forEach(file => {
            fs.unlink(file.path, (err) => {
              if (err) console.error('Error deleting file:', err);
            });
          });
        }
        
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: { product }
      });

    } catch (error) {
      console.error('Update product error:', error);
      
      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          error: 'Duplicate Error',
          message: `${field} already exists`
        });
      }
      
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update product'
      });
    }
  }
);

// @route   DELETE /api/admin/products/:id
// @desc    Delete product (Admin only)
// @access  Private/Admin
router.delete('/:id',
  authenticate,
  authorize('admin'),
  logActivity('delete_product'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found'
        });
      }

      // Delete associated image files
      if (product.images && product.images.length > 0) {
        product.images.forEach(imagePath => {
          const fullPath = path.join(__dirname, '../..', imagePath);
          fs.unlink(fullPath, (err) => {
            if (err) console.error('Error deleting image file:', err);
          });
        });
      }

      await Product.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({
        error: 'Delete Failed',
        message: 'Unable to delete product'
      });
    }
  }
);

// @route   GET /api/admin/products/stats
// @desc    Get product statistics
// @access  Private/Admin
router.get('/stats',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const stats = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
            featuredProducts: { $sum: { $cond: ['$isFeatured', 1, 0] } },
            inStockProducts: { $sum: { $cond: ['$inStock', 1, 0] } },
            totalValue: { $sum: { $multiply: ['$price', '$totalStock'] } },
            totalStock: { $sum: '$totalStock' },
            totalSold: { $sum: '$soldCount' }
          }
        }
      ]);

      const categoryStats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$price', '$totalStock'] } },
            totalStock: { $sum: '$totalStock' },
            soldCount: { $sum: '$soldCount' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const sizeStats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$size',
            count: { $sum: 1 },
            totalStock: { $sum: '$totalStock' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const colourStats = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$colour',
            count: { $sum: 1 },
            totalStock: { $sum: '$totalStock' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        overview: stats[0] || {
          totalProducts: 0,
          activeProducts: 0,
          featuredProducts: 0,
          inStockProducts: 0,
          totalValue: 0,
          totalStock: 0,
          totalSold: 0
        },
        categoryBreakdown: categoryStats,
        sizeBreakdown: sizeStats,
        colourBreakdown: colourStats
      });

    } catch (error) {
      console.error('Get product stats error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch product statistics'
      });
    }
  }
);

// @route   PUT /api/admin/products/:id/toggle-featured
// @desc    Toggle product featured status
// @access  Private/Admin
router.put('/:id/toggle-featured',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found'
        });
      }

      product.isFeatured = !product.isFeatured;
      await product.save();

      res.json({
        success: true,
        message: `Product ${product.isFeatured ? 'marked as featured' : 'removed from featured'}`,
        data: { 
          product: {
            _id: product._id,
            name: product.name,
            isFeatured: product.isFeatured
          }
        }
      });

    } catch (error) {
      console.error('Toggle featured error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update featured status'
      });
    }
  }
);

// @route   PUT /api/admin/products/:id/toggle-active
// @desc    Toggle product active status
// @access  Private/Admin
router.put('/:id/toggle-active',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found'
        });
      }

      product.isActive = !product.isActive;
      await product.save();

      res.json({
        success: true,
        message: `Product ${product.isActive ? 'activated' : 'deactivated'}`,
        data: { 
          product: {
            _id: product._id,
            name: product.name,
            isActive: product.isActive
          }
        }
      });

    } catch (error) {
      console.error('Toggle active error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update active status'
      });
    }
  }
);

module.exports = router;

