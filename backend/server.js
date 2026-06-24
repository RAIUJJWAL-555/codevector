// ============================================================
// BACKEND SERVER - Express.js + MongoDB
// Yeh code products ki list dikhata hai cursor pagination ke saath
// ============================================================

// ----- SETUP (SAMAAN JUTAO) -----
require('dotenv').config();           // .env file padhne ke liye
const express = require('express');   // web server banane ka framework
const mongoose = require('mongoose'); // MongoDB se baat karne ke liye
const cors = require('cors');         // frontend ko backend se baat karne deta hai
const Product = require('./models/Product');

const app = express();
app.use(cors({
  origin: ['https://codevector-kohl.vercel.app', 'http://localhost:5173'],
}));            // allow frontend to talk to backend
app.use(express.json());    // JSON data samajhne ke liye

// ============================================================
// CURSOR PAGINATION - SAMJHO PEHLE
// ============================================================
//
// Normal pagination (skip/offset):
//   Pehle 20 products → phir 20 skip karke agle 20
//   PROBLEM: 200k products mein skip DHEEMI ho jati hai
//   PROBLEM: Beech mein naya product aaya to pagination shift ho jati hai
//
// Cursor pagination:
//   "Last product ka time aur ID yaad rakh lo"
//   "Us time/ID se pehle wale products lao"
//   PROBLEM NAHI: Ek dum fast (index use karta hai)
//   PROBLEM NAHI: Naya product aaya to farak nahi padta
//
// Hum sort karte hain: (created_at DESC, _id DESC)
// DESC = newest first (jo abhi bana woh pehle dikhega)
// _id tie-breaker hai agar same time pe multiple products bane hon
//
// Cursor ka matlab:
//   client ko ek "token" dedo (base64 encoded string)
//   woh wapas bhejega token → hum samajhenge "yeh last product tha, iske aage wale lao"

// ----- CURSOR HELPERS -----

// Cursor BANANA: last product ka (created_at, _id) ko base64 string mein convert karo
function createCursor(createdAt, id) {
  // Ek object banao jisme createdAt aur id ho
  const cursorData = {
    createdAt: createdAt.toISOString(),  // Date ko string mein badlo
    id: id.toString(),                   // ObjectId ko string mein badlo
  };
  // JSON mein convert karo → base64 mein encode karo
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

// Cursor SE DATA NIKALNA: base64 string ko wapas { createdAt, id } mein badlo
function readCursor(cursor) {
  try {
    // base64 → readable string → JSON object
    const rawString = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(rawString);
    return {
      createdAt: new Date(parsed.createdAt),                     // string → Date
      id: new mongoose.Types.ObjectId(parsed.id),                // string → ObjectId
    };
  } catch (error) {
    return null;  // agar cursor galat hai to null return karo
  }
}

// ============================================================
// API ROUTES (YE ENDPOINTS FRONTEND CALL KARTA HAI)
// ============================================================

// ----- GET /api/products - Products ki list (cursor pagination ke saath) -----
app.get('/api/products', async (req, res) => {
  // Step 1: Request se parameters nikaalo
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // kitne products chahiye (max 100)
  const category = req.query.category || null;                        // category filter (optional)
  const cursor = req.query.cursor || null;                            // cursor (optional, agle page ke liye)

  // Step 2: MongoDB query filter banao
  const filter = {};

  // Agar category di hai to sirf woh category ke products dikhao
  if (category) {
    filter.category = category;
  }

  // Step 3: Agar cursor hai to pagination condition lagao
  // Yeh cursor pagination ka CORE logic hai
  if (cursor) {
    const decoded = readCursor(cursor);

    // Agar cursor galat hai to error bhejo
    if (!decoded) {
      return res.status(400).json({ error: 'Cursor invalid hai. Dobara try karo.' });
    }

    // SAMJHO: products DESCENDING order mein hain (newest first)
    // Cursor ka matlab hai "yeh product hum pehle dikha chuke hain"
    // Ab hume woh products chahiye jo is product se PEHLE aate hain (sorting mein)
    //
    // Condition:
    //   (created_at < cursor.createdAt)  → purane products
    //   ya
    //   (created_at == cursor.createdAt AND _id < cursor.id)  → same time wale but purane _id wale
    filter.$or = [
      { created_at: { $lt: decoded.createdAt } },  // created_at chhota hai (puranee)
      {
        created_at: decoded.createdAt,              // same time
        _id: { $lt: decoded.id },                   // lekin _id chhota hai
      },
    ];
  }

  // Step 4: MongoDB se products lao
  // limit + 1 isliye le rahe hain taaki pata chale "aur products hain ya nahi"
  // Agar limit+1 total aaye to matlab aur bhi hain
  const products = await Product
    .find(filter)                            // filter lagao
    .sort({ created_at: -1, _id: -1 })       // sort karo (newest first)
    .limit(limit + 1)                        // ek extra product lao
    .lean();                                 // lean = sirf plain JS object, fast

  // Step 5: Check karo "aur products hain ya nahi"
  const hasMoreProducts = products.length > limit;
  let nextCursor = null;

  if (hasMoreProducts) {
    // Extra wala product hata do (woh agle page ka pehla product hai)
    products.pop();

    // Last product ka cursor banao (agle page ke liye)
    const lastProduct = products[products.length - 1];
    nextCursor = createCursor(lastProduct.created_at, lastProduct._id);
  }

  // Step 6: Response mein _id ko id bana do (clean API ke liye)
  const items = products.map((product) => ({
    id: product._id,
    name: product.name,
    category: product.category,
    price: product.price,
    created_at: product.created_at,
    updated_at: product.updated_at,
  }));

  // Step 7: Client ko bhejo
  res.json({
    items: items,
    nextCursor: nextCursor,  // null hai to matlab "aur koi products nahi"
  });
});

// ----- GET /api/categories - Sab categories ki list -----
app.get('/api/categories', async (_req, res) => {
  // MongoDB se distinct categories nikaalo
  const categories = await Product.distinct('category');
  res.json({ categories: categories });
});

// ----- GET /api/health - Server healthy hai ya nahi? -----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================
// SERVER START KARO
// ============================================================

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI nahi mila. .env file banao aur daalo.');
  process.exit(1);
}

// Pehle MongoDB se connect, phir server start
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB se connect ho gaye!');
    app.listen(PORT, () => {
      console.log(`Server chal raha hai: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection fail:', error);
    process.exit(1);
  });
