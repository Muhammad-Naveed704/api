const express = require('express');
const Product = require('../models/Product');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/products
// @desc    Get products with filters and pagination (User access)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12, // Default 12 products per page as per requirements
      sort = 'trending', // Default trending sort
      search,
      category,
      tags,
      minPrice,
      maxPrice,
      colour,
      size,
      inStock
    } = req.query;

    // Build query for active products only
    let query = { isActive: true };
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }
    
    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
    }
    
    // Filter by colour
    if (colour) {
      query.colour = colour;
    }
    
    // Filter by size
    if (size) {
      query.size = size;
    }
    
    // Filter by stock
    if (inStock === 'true') {
      query.inStock = true;
    }

    // Sorting logic
    let sortQuery = {};
    switch (sort) {
      case 'trending':
      case 'popularity':
        sortQuery = { soldCount: -1, createdAt: -1 };
        break;
      case 'price-low-high':
        sortQuery = { price: 1 };
        break;
      case 'price-high-low':
        sortQuery = { price: -1 };
        break;
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      case 'oldest':
        sortQuery = { createdAt: 1 };
        break;
      case 'name-a-z':
        sortQuery = { name: 1 };
        break;
      case 'name-z-a':
        sortQuery = { name: -1 };
        break;
      default:
        sortQuery = { soldCount: -1, createdAt: -1 }; // Default trending
    }

    // Execute query with pagination
    const products = await Product.find(query)
      .sort(sortQuery)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-createdBy'); // Don't expose creator info to users

    // Get total count for pagination
    const total = await Product.countDocuments(query);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts: total,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch products'
    });
  }
});

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      isActive: true,
      isFeatured: true
    })
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select('-createdBy');

    res.json({
      success: true,
      data: { products }
    });

  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch featured products'
    });
  }
});

// @route   GET /api/products/trending
// @desc    Get trending products (sorted by soldCount)
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    const products = await Product.find({
      isActive: true,
      inStock: true
    })
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select('-createdBy');

    res.json({
      success: true,
      data: { products }
    });

  } catch (error) {
    console.error('Get trending products error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch trending products'
    });
  }
});

// @route   GET /api/products/slug/:slug
// @desc    Get product by slug
// @access  Public
router.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ 
      slug: slug, 
      isActive: true 
    }).select('-createdBy');

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
    console.error('Get product by slug error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch product'
    });
  }
});

// @route   GET /api/products/categories
// @desc    Get all categories with product counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          inStockCount: { $sum: { $cond: ['$inStock', 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch categories'
    });
  }
});

// @route   GET /api/products/tags
// @desc    Get all tags with usage counts
// @access  Public
router.get('/tags', async (req, res) => {
  try {
    const tags = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 } // Top 50 tags
    ]);

    res.json({
      success: true,
      data: { tags }
    });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch tags'
    });
  }
});

// @route   GET /api/products/filters
// @desc    Get all available filter options
// @access  Public
router.get('/filters', async (req, res) => {
  try {
    // Get unique colours
    const colours = await Product.distinct('colour', { isActive: true });
    
    // Get unique sizes
    const sizes = await Product.distinct('size', { isActive: true });
    
    // Get price range
    const priceRange = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        colours: colours.sort(),
        sizes: ['sm', 'md', 'lg', 'xl'], // Keep consistent order
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 1000 }
      }
    });

  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch filter options'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      isActive: true
    }).select('-createdBy');

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
});

module.exports = router;