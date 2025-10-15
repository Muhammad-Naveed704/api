const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: true
  }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'USA'
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
  }
});

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  paymentDate: {
    type: Date
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  gateway: {
    type: String,
    enum: ['stripe', 'paypal', 'square', 'manual']
  },
  gatewayTransactionId: {
    type: String
  },
  failureReason: {
    type: String
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  
  // Pricing
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed'
    }
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },

  // Addresses
  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },
  billingAddress: {
    type: shippingAddressSchema
  },
  useSameAddress: {
    type: Boolean,
    default: true
  },

  // Payment
  paymentInfo: paymentInfoSchema,

  // Order Status
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
      'returned'
    ],
    default: 'pending'
  },
  
  // Tracking
  tracking: {
    carrier: {
      type: String,
      trim: true
    },
    trackingNumber: {
      type: String,
      trim: true
    },
    trackingUrl: {
      type: String,
      trim: true
    },
    estimatedDelivery: {
      type: Date
    },
    actualDelivery: {
      type: Date
    }
  },

  // Status History
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Special Instructions
  notes: {
    customer: {
      type: String,
      trim: true,
      maxlength: [500, 'Customer notes cannot exceed 500 characters']
    },
    internal: {
      type: String,
      trim: true,
      maxlength: [1000, 'Internal notes cannot exceed 1000 characters']
    }
  },

  // Delivery Options
  deliveryOption: {
    type: String,
    enum: ['standard', 'express', 'overnight', 'pickup'],
    default: 'standard'
  },
  
  // Dates
  confirmedAt: {
    type: Date
  },
  shippedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  
  // Refund/Return Info
  refund: {
    amount: {
      type: Number,
      min: 0
    },
    reason: {
      type: String,
      trim: true
    },
    processedAt: {
      type: Date
    },
    refundId: {
      type: String
    }
  },

  // Metadata
  source: {
    type: String,
    enum: ['web', 'mobile', 'admin', 'api'],
    default: 'web'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for items count
orderSchema.virtual('itemsCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for formatted order number
orderSchema.virtual('formattedOrderNumber').get(function() {
  return `#${this.orderNumber}`;
});

// Virtual to check if order can be cancelled
orderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'confirmed'].includes(this.status);
});

// Virtual to check if order is completed
orderSchema.virtual('isCompleted').get(function() {
  return ['delivered', 'cancelled', 'refunded', 'returned'].includes(this.status);
});

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.status': 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate order number: ORD + timestamp + random
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `ORD${timestamp}${random}`;
    
    // Add initial status to history
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      note: 'Order created'
    });
  }
  
  next();
});

// Method to update status
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = null) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    date: new Date(),
    note: note || `Status changed from ${oldStatus} to ${newStatus}`,
    updatedBy
  });

  // Update specific date fields based on status
  const now = new Date();
  switch (newStatus) {
    case 'confirmed':
      this.confirmedAt = now;
      break;
    case 'shipped':
      this.shippedAt = now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'cancelled':
      this.cancelledAt = now;
      break;
  }

  return this.save();
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
  // Calculate subtotal
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calculate tax
  this.tax = this.subtotal * this.taxRate;

  // Calculate discount
  let discountAmount = 0;
  if (this.discount.amount > 0) {
    if (this.discount.type === 'percentage') {
      discountAmount = this.subtotal * (this.discount.amount / 100);
    } else {
      discountAmount = this.discount.amount;
    }
  }

  // Calculate total
  this.total = this.subtotal + this.tax + this.shippingCost - discountAmount;
  this.total = Math.max(0, this.total); // Ensure total is not negative

  // Update payment amount
  if (this.paymentInfo) {
    this.paymentInfo.amount = this.total;
  }
};

// Method to add tracking information
orderSchema.methods.addTracking = function(carrier, trackingNumber, trackingUrl = '', estimatedDelivery = null) {
  this.tracking = {
    carrier,
    trackingNumber,
    trackingUrl,
    estimatedDelivery
  };
  
  return this.save();
};

// Method to process refund
orderSchema.methods.processRefund = function(amount, reason, refundId = null) {
  this.refund = {
    amount,
    reason,
    processedAt: new Date(),
    refundId
  };
  
  this.status = 'refunded';
  this.statusHistory.push({
    status: 'refunded',
    date: new Date(),
    note: `Refund processed: $${amount}. Reason: ${reason}`
  });
  
  return this.save();
};

// Static method to get order statistics
orderSchema.statics.getStats = async function(userId = null) {
  const matchQuery = userId ? { user: userId } : {};
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0
  };
};

// Static method to get orders by date range
orderSchema.statics.getOrdersByDateRange = function(startDate, endDate, userId = null) {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (userId) {
    query.user = userId;
  }

  return this.find(query)
    .populate('user', 'name email')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Order', orderSchema);
