import { store } from './offlineStore';

const categories = ['Beverages', 'Snacks', 'Meals', 'Desserts', 'Combos'];

function money(n){ return Math.round(n*100)/100; }

export async function seedCatalogIfEmpty(){
  const existing = await store.getAll('products');
  if (existing && existing.length >= 1000) return;

  const products = [];
  for (let i=0; i<1200; i++){
    const cat = categories[i % categories.length];
    const sku = 'SKU' + String(i).padStart(4, '0');
    products.push({
      id: sku,
      sku,
      name: `${cat.slice(0,-1)} ${i+1}`,
      category: cat,
      basePrice: money(1.5 + (i % 30) * 0.35),
      options: {
        sizes: [
          { label: 'S', delta: 0 },
          { label: 'M', delta: 0.5 },
          { label: 'L', delta: 1.0 }
        ],
        addons: [
          { label: 'Extra Cheese', delta: 0.75 },
          { label: 'Spicy', delta: 0.25 },
          { label: 'No Onion', delta: 0 }
        ]
      },
      version: 1,
      updatedAt: Date.now()
    });
  }

  // transactional seed to keep consistent
  for (const p of products){
    await store.put('products', p, 'id');
  }
}
