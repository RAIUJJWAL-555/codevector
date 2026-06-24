const mongoose = require('mongoose');


const productSchema = new mongoose.Schema({
  name: { type: String, required: true },     
  category: { type: String, required: true }, // category (e.g. Electronics, Sports)
  price: { type: Number, required: true },    
  created_at: { type: Date, required: true }, 
  updated_at: { type: Date, required: true }, 
});


// Jab user kisi specific category filter kare, tab yeh index use hota hai
productSchema.index({ category: 1, created_at: -1, _id: -1 });

// Jab user "All" categories dekhe (bina filter ke), tab yeh index use hota ha
productSchema.index({ created_at: -1, _id: -1 });



module.exports = mongoose.model('Product', productSchema);
