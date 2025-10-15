const express = require('express');
const { body, validationResult } = require('express-validator');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/checkout
// @desc    Process checkout and create order summary
// @access  Private
router.post('/',
  authenticate,
  logActivity('checkout_process'),
  async (req, res) => {
    try {
      // Get user's cart
      const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.product', 'name slug price totalStock soldCount inStock images');

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          error: 'Empty Cart',
          message: 'Your cart is empty. Please add items before checkout.'
        });
      }

      // Validate stock availability for all items
      const stockIssues = [];
      for (const item of cart.items) {
        const product = item.product;
        
        if (!product.inStock || product.availableStock < item.quantity) {
          stockIssues.push({
            productName: product.name,
            variant: `${item.variant.colour}/${item.variant.size}`,
            requested: item.quantity,
            available: product.availableStock
          });
        }
      }

      if (stockIssues.length > 0) {
        return res.status(400).json({
          error: 'Stock Issues',
          message: 'Some items in your cart are no longer available in the requested quantity',
          details: stockIssues
        });
      }

      // Calculate order summary
      const subtotal = cart.totalAmount;
      const taxRate = 0.1; // 10% tax
      const tax = subtotal * taxRate;
      const shippingThreshold = 100;
      const shippingCost = subtotal >= shippingThreshold ? 0 : 10;
      const total = subtotal + tax + shippingCost;

      // Create detailed order summary
      const orderSummary = {
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        customer: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        items: cart.items.map(item => ({
          product: {
            id: item.product._id,
            name: item.product.name,
            slug: item.product.slug,
            images: item.product.images,
            price: item.price
          },
          variant: {
            colour: item.variant.colour,
            size: item.variant.size
          },
          quantity: item.quantity,
          itemTotal: (item.price * item.quantity).toFixed(2)
        })),
        pricing: {
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          taxRate: (taxRate * 100).toFixed(1) + '%',
          shipping: shippingCost.toFixed(2),
          shippingNote: subtotal >= shippingThreshold ? 'Free shipping (order over $100)' : 'Standard shipping',
          total: total.toFixed(2)
        },
        summary: {
          totalItems: cart.totalItems,
          uniqueProducts: cart.items.length,
          estimatedDelivery: '3-5 business days'
        }
      };

      // Simulate Stripe checkout process
      const stripeCheckoutSimulation = {
        paymentIntentId: `pi_${Math.random().toString(36).substr(2, 24)}`,
        clientSecret: `pi_${Math.random().toString(36).substr(2, 24)}_secret_${Math.random().toString(36).substr(2, 24)}`,
        amount: Math.round(total * 100), // Amount in cents for Stripe
        currency: 'usd',
        status: 'requires_payment_method'
      };

      // In a real implementation, you would:
      // 1. Create Stripe payment intent with the total amount
      // 2. Return client secret to frontend
      // 3. Frontend handles Stripe payment form
      // 4. On successful payment, webhook updates order status
      // 5. Update product stock and clear cart

      res.json({
        success: true,
        message: 'Checkout summary generated successfully',
        data: {
          orderSummary,
          stripePayment: stripeCheckoutSimulation,
          nextSteps: [
            'Review your order summary',
            'Complete payment using Stripe',
            'Receive order confirmation',
            'Track your order'
          ]
        }
      });

    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({
        error: 'Checkout Failed',
        message: 'Unable to process checkout. Please try again.'
      });
    }
  }
);

// @route   POST /api/checkout/complete
// @desc    Complete checkout after successful payment
// @access  Private
router.post('/complete',
  authenticate,
  [
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    body('orderId').notEmpty().withMessage('Order ID is required')
  ],
  logActivity('checkout_complete'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      const { paymentIntentId, orderId } = req.body;

      // Get user's cart
      const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.product');

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          error: 'Empty Cart',
          message: 'Cart is empty'
        });
      }

      // Simulate payment verification (in real app, verify with Stripe)
      const paymentVerified = true; // This would be actual Stripe verification

      if (!paymentVerified) {
        return res.status(400).json({
          error: 'Payment Failed',
          message: 'Payment could not be verified'
        });
      }

      // Update product stock and sold count
      for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          await product.updateSoldCount(item.quantity);
        }
      }

      // Create order record (simplified)
      const orderData = {
        user: req.user._id,
        orderId: orderId,
        items: cart.items.map(item => ({
          product: item.product._id,
          name: item.product.name,
          variant: item.variant,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: cart.totalAmount,
        paymentIntentId: paymentIntentId,
        status: 'confirmed',
        paymentStatus: 'paid'
      };

      // In a real app, you would save this to an Order model
      // const order = new Order(orderData);
      // await order.save();

      // Clear user's cart
      await cart.clearCart();

      res.json({
        success: true,
        message: 'Purchase completed successfully! Thank you for your order.',
        data: {
          order: orderData,
          confirmationMessage: 'Your order has been confirmed and will be processed shortly.',
          trackingInfo: 'You will receive tracking information via email once your order ships.',
          estimatedDelivery: '3-5 business days'
        }
      });

    } catch (error) {
      console.error('Complete checkout error:', error);
      res.status(500).json({
        error: 'Checkout Completion Failed',
        message: 'Unable to complete checkout'
      });
    }
  }
);

module.exports = router;
