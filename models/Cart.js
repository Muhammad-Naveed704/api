const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  // Variant information for same product with different attributes
  variant: {
    colour: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true,
      enum: ['sm', 'md', 'lg', 'xl']
    }
  },
  price: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  next();
});

// Method to add item with variant support
cartSchema.methods.addItem = function(productId, quantity, variant, price) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    item.variant.colour === variant.colour &&
    item.variant.size === variant.size
  );

  if (existingItemIndex >= 0) {
    // Update quantity of existing variant
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new variant as separate item
    this.items.push({
      product: productId,
      quantity: quantity,
      variant: variant,
      price: price
    });
  }

  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      this.items.pull({ _id: itemId });
    } else {
      item.quantity = quantity;
    }
  }
  return this.save();
};

// Method to remove item
cartSchema.methods.removeItem = function(itemId) {
  this.items.pull({ _id: itemId });
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);
