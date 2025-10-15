const express = require('express');
const { body } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, authorize, checkOwnership, logActivity } = require('../middleware/auth');
const {
  validateOrder,
  validateOrderStatusUpdate,
  validateObjectId,
  validatePagination,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/orders
// @desc    Get orders (Admin gets all, users get their own)
// @access  Private
router.get('/',
  authenticate,
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sort = '-createdAt',
        status,
        startDate,
        endDate
      } = req.query;

      // Build query based on user role
      let query = {};
      if (req.user.role !== 'admin') {
        query.user = req.user._id;
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Filter by date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Execute query with pagination
      const orders = await Order.find(query)
        .populate('user', 'name email')
        .populate('items.product', 'name images price')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Get total count for pagination
      const total = await Order.countDocuments(query);
      
      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalOrders: total,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch orders'
      });
    }
  }
);

// @route   GET /api/orders/stats
// @desc    Get order statistics
// @access  Private
router.get('/stats',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user._id;
      const stats = await Order.getStats(userId);
      
      res.json({
        success: true,
        data: { stats }
      });

    } catch (error) {
      console.error('Get order stats error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch order statistics'
      });
    }
  }
);

// @route   GET /api/orders/:id
// @desc    Get single order by ID
// @access  Private (Own order or Admin)
router.get('/:id',
  authenticate,
  validateObjectId('id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      let query = { _id: id };
      if (req.user.role !== 'admin') {
        query.user = req.user._id;
      }

      const order = await Order.findOne(query)
        .populate('user', 'name email phone')
        .populate('items.product', 'name images price sku');

      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        data: { order }
      });

    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to fetch order'
      });
    }
  }
);

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/',
  authenticate,
  validateOrder,
  logActivity('create_order'),
  async (req, res) => {
    try {
      const {
        items,
        shippingAddress,
        billingAddress,
        useSameAddress,
        paymentInfo,
        deliveryOption,
        notes
      } = req.body;

      // Validate and calculate order totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product);
        
        if (!product) {
          return res.status(400).json({
            error: 'Product Not Found',
            message: `Product with ID ${item.product} not found`
          });
        }

        if (!product.isActive) {
          return res.status(400).json({
            error: 'Product Unavailable',
            message: `Product ${product.name} is not available`
          });
        }

        if (product.availableQuantity < item.quantity) {
          return res.status(400).json({
            error: 'Insufficient Stock',
            message: `Not enough stock for ${product.name}. Available: ${product.availableQuantity}`
          });
        }

        const itemPrice = product.finalPrice;
        const itemTotal = itemPrice * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product: product._id,
          name: product.name,
          price: itemPrice,
          quantity: item.quantity,
          image: product.primaryImage?.url || '',
          sku: product.sku
        });

        // Reserve inventory
        await product.reserveInventory(item.quantity);
      }

      // Calculate tax (assuming 8.25% tax rate)
      const taxRate = 0.0825;
      const tax = subtotal * taxRate;

      // Calculate shipping cost (simple logic)
      let shippingCost = 0;
      if (deliveryOption === 'express') {
        shippingCost = 15;
      } else if (deliveryOption === 'overnight') {
        shippingCost = 25;
      } else if (subtotal < 50) {
        shippingCost = 5;
      }

      // Calculate total
      const total = subtotal + tax + shippingCost;

      // Create order
      const orderData = {
        user: req.user._id,
        items: orderItems,
        subtotal,
        tax,
        taxRate,
        shippingCost,
        total,
        shippingAddress,
        billingAddress: useSameAddress ? shippingAddress : billingAddress,
        useSameAddress,
        paymentInfo: {
          ...paymentInfo,
          amount: total
        },
        deliveryOption,
        notes: notes || {},
        source: 'web',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const order = new Order(orderData);
      order.calculateTotals(); // Ensure totals are correct
      await order.save();

      // Populate order data
      await order.populate('user', 'name email')
                 .populate('items.product', 'name images');

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: { order }
      });

    } catch (error) {
      console.error('Create order error:', error);
      
      // Release any reserved inventory on error
      if (req.body.items) {
        for (const item of req.body.items) {
          try {
            const product = await Product.findById(item.product);
            if (product) {
              await product.releaseReservedInventory(item.quantity);
            }
          } catch (releaseError) {
            console.error('Error releasing inventory:', releaseError);
          }
        }
      }
      
      res.status(500).json({
        error: 'Order Creation Failed',
        message: 'Unable to create order. Please try again.'
      });
    }
  }
);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put('/:id/status',
  authenticate,
  authorize('admin', 'moderator'),
  validateObjectId('id'),
  validateOrderStatusUpdate,
  logActivity('update_order_status'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      // Validate status transition
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'returned'],
        'delivered': ['returned'],
        'cancelled': [],
        'refunded': [],
        'returned': ['refunded']
      };

      if (!validTransitions[order.status].includes(status)) {
        return res.status(400).json({
          error: 'Invalid Status Transition',
          message: `Cannot change status from ${order.status} to ${status}`
        });
      }

      // Handle inventory changes based on status
      if (status === 'cancelled' && ['pending', 'confirmed', 'processing'].includes(order.status)) {
        // Release reserved inventory and restore stock
        for (const item of order.items) {
          const product = await Product.findById(item.product);
          if (product) {
            await product.releaseReservedInventory(item.quantity);
            await product.updateInventory(item.quantity, 'add');
          }
        }
      } else if (status === 'shipped' && order.status === 'processing') {
        // Deduct inventory from stock (convert reserved to sold)
        for (const item of order.items) {
          const product = await Product.findById(item.product);
          if (product) {
            await product.releaseReservedInventory(item.quantity);
            await product.updateInventory(item.quantity, 'subtract');
          }
        }
      }

      // Update order status
      await order.updateStatus(status, note, req.user._id);

      // Populate updated order
      await order.populate('user', 'name email')
                 .populate('items.product', 'name images');

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: { order }
      });

    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to update order status'
      });
    }
  }
);

// @route   PUT /api/orders/:id/tracking
// @desc    Add tracking information to order
// @access  Private/Admin
router.put('/:id/tracking',
  authenticate,
  authorize('admin', 'moderator'),
  validateObjectId('id'),
  [
    body('carrier').notEmpty().withMessage('Carrier is required'),
    body('trackingNumber').notEmpty().withMessage('Tracking number is required'),
    body('trackingUrl').optional().isURL().withMessage('Tracking URL must be valid'),
    body('estimatedDelivery').optional().isISO8601().withMessage('Estimated delivery must be a valid date'),
    handleValidationErrors
  ],
  logActivity('add_order_tracking'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { carrier, trackingNumber, trackingUrl, estimatedDelivery } = req.body;

      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      // Add tracking information
      await order.addTracking(carrier, trackingNumber, trackingUrl, estimatedDelivery);

      // If order is not already shipped, update status
      if (order.status === 'processing') {
        await order.updateStatus('shipped', 'Order shipped with tracking information', req.user._id);
      }

      res.json({
        success: true,
        message: 'Tracking information added successfully',
        data: { 
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            tracking: order.tracking
          }
        }
      });

    } catch (error) {
      console.error('Add tracking error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: 'Unable to add tracking information'
      });
    }
  }
);

// @route   POST /api/orders/:id/cancel
// @desc    Cancel an order
// @access  Private (Own order or Admin)
router.post('/:id/cancel',
  authenticate,
  validateObjectId('id'),
  [
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
    handleValidationErrors
  ],
  logActivity('cancel_order'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      let query = { _id: id };
      if (req.user.role !== 'admin') {
        query.user = req.user._id;
      }

      const order = await Order.findOne(query);
      
      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      if (!order.canBeCancelled) {
        return res.status(400).json({
          error: 'Cannot Cancel Order',
          message: 'Order cannot be cancelled in its current status'
        });
      }

      // Cancel the order
      await order.updateStatus('cancelled', reason || 'Cancelled by user', req.user._id);

      // Release inventory
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          await product.releaseReservedInventory(item.quantity);
          await product.updateInventory(item.quantity, 'add');
        }
      }

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: { 
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            cancelledAt: order.cancelledAt
          }
        }
      });

    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        error: 'Cancellation Failed',
        message: 'Unable to cancel order'
      });
    }
  }
);

// @route   POST /api/orders/:id/refund
// @desc    Process refund for an order
// @access  Private/Admin
router.post('/:id/refund',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  [
    body('amount').isFloat({ min: 0 }).withMessage('Refund amount must be positive'),
    body('reason').notEmpty().withMessage('Refund reason is required'),
    body('refundId').optional().trim().notEmpty().withMessage('Refund ID cannot be empty'),
    handleValidationErrors
  ],
  logActivity('process_order_refund'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason, refundId } = req.body;

      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      if (amount > order.total) {
        return res.status(400).json({
          error: 'Invalid Refund Amount',
          message: 'Refund amount cannot exceed order total'
        });
      }

      // Process refund
      await order.processRefund(amount, reason, refundId);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: { 
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            refund: order.refund
          }
        }
      });

    } catch (error) {
      console.error('Process refund error:', error);
      res.status(500).json({
        error: 'Refund Failed',
        message: 'Unable to process refund'
      });
    }
  }
);

// @route   GET /api/orders/:id/invoice
// @desc    Get order invoice
// @access  Private (Own order or Admin)
router.get('/:id/invoice',
  authenticate,
  validateObjectId('id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      let query = { _id: id };
      if (req.user.role !== 'admin') {
        query.user = req.user._id;
      }

      const order = await Order.findOne(query)
        .populate('user', 'name email phone address')
        .populate('items.product', 'name sku');

      if (!order) {
        return res.status(404).json({
          error: 'Order Not Found',
          message: 'Order not found'
        });
      }

      // In a real application, you might generate a PDF invoice here
      const invoice = {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        customer: order.user,
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingCost: order.shippingCost,
        total: order.total,
        paymentInfo: {
          method: order.paymentInfo.method,
          status: order.paymentInfo.status,
          transactionId: order.paymentInfo.transactionId
        }
      };

      res.json({
        success: true,
        data: { invoice }
      });

    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Unable to generate invoice'
      });
    }
  }
);

module.exports = router;
