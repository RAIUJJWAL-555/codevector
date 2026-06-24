import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProductCard({ product }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <p className="font-semibold text-gray-900 mb-1">{product.name}</p>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
          {product.category}
        </span>
        <span className="font-bold text-emerald-600">${product.price.toFixed(2)}</span>
      </div>
      <p className="text-xs text-gray-400">{formatDate(product.created_at)}</p>
    </div>
  );
}

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const isFirstLoadDone = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProducts([]);
    setNextCursor(null);
    isFirstLoadDone.current = false;

    fetch(`${API_BASE}/products?limit=20${selectedCategory ? `&category=${selectedCategory}` : ''}`)
      .then((r) => r.json())
      .then((result) => {
        if (cancelled) return;
        setProducts(result.items);
        setNextCursor(result.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setError('Products load nahi ho paaye.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          isFirstLoadDone.current = true;
        }
      });

    return () => { cancelled = true; };
  }, [selectedCategory]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);

    try {
      const res = await fetch(
        `${API_BASE}/products?limit=20&cursor=${nextCursor}${selectedCategory ? `&category=${selectedCategory}` : ''}`
      );
      const result = await res.json();
      setProducts((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch {
      setError('Load more fail ho gaya.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">CodeVector Products</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="category" className="text-sm font-semibold text-gray-700">Category:</label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
          >
            <option value="">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="min-h-[40vh]">
        {isLoading && (
          <p className="text-center text-gray-500 py-12">Loading products...</p>
        )}

        {error && (
          <p className="text-center text-red-600 py-12">{error}</p>
        )}

        {!isLoading && !error && products.length === 0 && isFirstLoadDone.current && (
          <p className="text-center text-gray-500 py-12">Koi products nahi mile.</p>
        )}

        {!isLoading && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            <div className="text-center mt-6">
              {nextCursor ? (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-8 py-2.5 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              ) : (
                <p className="text-center text-gray-500 py-6 border-t border-gray-200 mt-6">
                  Saare products aa gaye.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
