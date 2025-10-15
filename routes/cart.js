const express = require('express');
const { body, validationResult } = require('express-validator');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.product', 'name slug images price colour size totalStock inStock');

      if (!cart) {
        return res.json({
          success: true,
          data: {
            cart: {
              items: [],
              totalAmount: 0,
              totalItems: 0
            }
          }
        });
      }

      res.json({
        success: true,
        data: { cart }
      });

    } catch (error) {
      console.error('Get cart error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch cart'
      });
    }
  }
);

// @route   POST /api/cart/add
// @desc    Add item to cart (with variant support)
// @access  Private
router.post('/add',
  authenticate,
  [
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('colour').notEmpty().withMessage('Colour is required'),
    body('size').isIn(['sm', 'md', 'lg', 'xl']).withMessage('Size must be sm, md, lg, or xl')
  ],
  logActivity('add_to_cart'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      const { productId, quantity, colour, size } = req.body;

      // Check if product exists and is active
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) {
        return res.status(404).json({
          error: 'Product Not Found',
          message: 'Product not found or inactive'
        });
      }

      // Check if product has the requested variant
      if (product.colour !== colour || product.size !== size) {
        return res.status(400).json({
          error: 'Variant Not Available',
          message: 'The requested colour/size combination is not available'
        });
      }

      // Check stock availability
      if (!product.inStock || product.availableStock < quantity) {
        return res.status(400).json({
          error: 'Insufficient Stock',
          message: `Only ${product.availableStock} items available`
        });
      }

      // Find or create cart
      let cart = await Cart.findOne({ user: req.user._id });
      if (!cart) {
        cart = new Cart({ user: req.user._id, items: [] });
      }

      // Check if same variant already exists in cart
      const existingItemIndex = cart.items.findIndex(item => 
        item.product.toString() === productId &&
        item.variant.colour === colour &&
        item.variant.size === size
      );

      if (existingItemIndex >= 0) {
        // Update quantity of existing variant
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        // Check if new quantity exceeds stock
        if (newQuantity > product.availableStock) {
          return res.status(400).json({
            error: 'Insufficient Stock',
            message: `Cannot add more items. Only ${product.availableStock} available`
          });
        }
        
        cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new variant as separate item
        cart.items.push({
          product: productId,
          quantity: quantity,
          variant: { colour, size },
          price: product.price
        });
      }

      await cart.save();
      await cart.populate('items.product', 'name slug images price colour size totalStock inStock');

      res.json({
        success: true,
        message: 'Item added to cart successfully',
        data: { cart }
      });

    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to add item to cart'
      });
    }
  }
);

// @route   PUT /api/cart/update/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put('/update/:itemId',
  authenticate,
  [
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      const { itemId } = req.params;
      const { quantity } = req.body;

      const cart = await Cart.findOne({ user: req.user._id });
      
      if (!cart) {
        return res.status(404).json({
          error: 'Cart Not Found',
          message: 'Cart not found'
        });
      }

      const item = cart.items.id(itemId);
      if (!item) {
        return res.status(404).json({
          error: 'Item Not Found',
          message: 'Item not found in cart'
        });
      }

      // Check stock availability
      const product = await Product.findById(item.product);
      if (quantity > 0 && (!product || !product.inStock || product.availableStock < quantity)) {
        return res.status(400).json({
          error: 'Insufficient Stock',
          message: `Only ${product?.availableStock || 0} items available`
        });
      }

      await cart.updateItemQuantity(itemId, quantity);
      await cart.populate('items.product', 'name slug images price colour size totalStock inStock');

      res.json({
        success: true,
        message: quantity === 0 ? 'Item removed from cart' : 'Cart updated successfully',
        data: { cart }
      });

    } catch (error) {
      console.error('Update cart error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to update cart'
      });
    }
  }
);

// @route   DELETE /api/cart/remove/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/remove/:itemId',
  authenticate,
  async (req, res) => {
    try {
      const { itemId } = req.params;

      const cart = await Cart.findOne({ user: req.user._id });
      
      if (!cart) {
        return res.status(404).json({
          error: 'Cart Not Found',
          message: 'Cart not found'
        });
      }

      await cart.removeItem(itemId);
      await cart.populate('items.product', 'name slug images price colour size totalStock inStock');

      res.json({
        success: true,
        message: 'Item removed from cart successfully',
        data: { cart }
      });

    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to remove item from cart'
      });
    }
  }
);

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear',
  authenticate,
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ user: req.user._id });
      
      if (!cart) {
        return res.json({
          success: true,
          message: 'Cart is already empty',
          data: {
            cart: {
              items: [],
              totalAmount: 0,
              totalItems: 0
            }
          }
        });
      }

      await cart.clearCart();

      res.json({
        success: true,
        message: 'Cart cleared successfully',
        data: {
          cart: {
            items: [],
            totalAmount: 0,
            totalItems: 0
          }
        }
      });

    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to clear cart'
      });
    }
  }
);

module.exports = router;
