/*
  simulate-writes.js

  Simulates concurrent write activity while a user is paginating:
    - Inserts 50 new products (created_at = now, so they appear at the top of
      the newest-first feed).
    - Updates 50 random existing products (changes price, bumps updated_at,
      but leaves created_at untouched — position in the feed is preserved).

  Use the --loop flag to repeat every 3 seconds until Ctrl+C.
  Run in a separate terminal while testing the frontend pagination.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const NAMES = [
  'Widget', 'Gadget', 'Doohickey', 'Thingamajig', 'Whatchamacallit',
  'Contraption', 'Apparatus', 'Device', 'Instrument', 'Tool',
  'Implement', 'Utensil', 'Fixture', 'Accessory', 'Component',
  'Module', 'Assembly', 'Unit', 'Part', 'Piece',
];

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books',
  'Toys', 'Automotive', 'Food & Drink', 'Health & Beauty', 'Office Supplies',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice() {
  return parseFloat((Math.random() * 500 + 0.99).toFixed(2));
}

function roundToMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

function generateProduct() {
  return {
    name: NAMES[randomInt(0, NAMES.length - 1)],
    category: CATEGORIES[randomInt(0, CATEGORIES.length - 1)],
    price: randomPrice(),
    created_at: roundToMinute(new Date()),
    updated_at: roundToMinute(new Date()),
  };
}

async function runOnce() {
  // 1. Insert 50 new products at the top of the feed
  const newProducts = Array.from({ length: 50 }, () => generateProduct());
  await Product.insertMany(newProducts, { ordered: false });

  // 2. Update 50 random products (change price, bump updated_at)
  const sample = await Product.aggregate([{ $sample: { size: 50 } }]);
  const now = roundToMinute(new Date());
  const updates = sample.map((doc) =>
    Product.updateOne(
      { _id: doc._id },
      { $set: { price: randomPrice(), updated_at: now } },
    ),
  );
  await Promise.all(updates);

  console.log(
    `[${now.toISOString()}] Inserted 50, updated 50`,
  );
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB. Simulating writes...');

  const useLoop = process.argv.includes('--loop');

  if (useLoop) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await runOnce();
      await new Promise((r) => setTimeout(r, 3000));
    }
  } else {
    await runOnce();
    await mongoose.disconnect();
    console.log('Done.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
