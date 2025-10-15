const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  colour: {
    type: String,
    required: [true, 'Product colour is required'],
    trim: true
  },
  size: {
    type: String,
    required: [true, 'Product size is required'],
    enum: {
      values: ['sm', 'md', 'lg', 'xl'],
      message: 'Size must be sm, md, lg, or xl'
    }
  },
  images: [{
    type: String, // Will store file paths or base64
    required: true
  }],
  inStock: {
    type: Boolean,
    default: true
  },
  totalStock: {
    type: Number,
    required: [true, 'Total stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  soldCount: {
    type: Number,
    default: 0,
    min: [0, 'Sold count cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  // Additional fields for better functionality
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available stock
productSchema.virtual('availableStock').get(function() {
  return this.totalStock - this.soldCount;
});

// Virtual for popularity score
productSchema.virtual('popularityScore').get(function() {
  return this.soldCount * 0.7 + (this.isFeatured ? 100 : 0);
});

// Auto-generate slug from name
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Update inStock based on available stock
  this.inStock = this.availableStock > 0;
  
  next();
});

// Indexes for better query performance
productSchema.index({ slug: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ inStock: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ colour: 1, size: 1 });

// Method to update sold count
productSchema.methods.updateSoldCount = function(quantity) {
  this.soldCount += quantity;
  this.inStock = this.availableStock > 0;
  return this.save();
};

// Static method to get trending products
productSchema.statics.getTrending = function(limit = 12) {
  return this.find({ isActive: true })
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Product', productSchema);