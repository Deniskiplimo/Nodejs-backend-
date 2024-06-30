const mongoose = require('mongoose');

let productSchema = mongoose.Schema({
  pname: {
    type: String,
    required: true
  },
  pprice: {
    type: Number,
    required: true
  },
  pdesc: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Product', productSchema);
