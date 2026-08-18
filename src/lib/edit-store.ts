import type { Product, Category, Turn } from './types';

// Store en memoria para pasar datos entre screens y modales sin contaminar la URL
let _product: Product | null = null;
let _category: Category | null = null;
let _stockProductId: string | null = null;
let _turn: Turn | null = null;

export const editStore = {
  setProduct: (p: Product | null) => { _product = p; },
  getProduct: () => _product,
  clearProduct: () => { _product = null; },

  setCategory: (c: Category | null) => { _category = c; },
  getCategory: () => _category,
  clearCategory: () => { _category = null; },

  setStockProductId: (id: string | null) => { _stockProductId = id; },
  getStockProductId: () => _stockProductId,
  clearStockProductId: () => { _stockProductId = null; },

  setTurn: (t: Turn | null) => { _turn = t; },
  getTurn: () => _turn,
  clearTurn: () => { _turn = null; },
};
