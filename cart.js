const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  }
});

const Cart = mongoose.model("Cart", cartSchema);

const addItem = async (id, name, price, quantity) => {
  try {
    let cartItem = await Cart.findOne({ id });
    if (cartItem) {
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      cartItem = new Cart({ id, name, price, quantity });
      await cartItem.save();
    }
    return cartItem;
  } catch (error) {
    throw error;
  }
};

const removeItem = async (id) => {
  try {
    await Cart.findOneAndDelete({ id });
  } catch (error) {
    throw error;
  }
};

const updateItemQuantity = async (id, quantity) => {
  try {
    let cartItem = await Cart.findOne({ id });
    if (cartItem) {
      cartItem.quantity = quantity;
      await cartItem.save();
      return cartItem;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

const getCart = async () => {
  try {
    const cartItems = await Cart.find();
    return cartItems;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  addItem,
  removeItem,
  updateItemQuantity,
  getCart,
};
