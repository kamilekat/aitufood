// Category photos (Unsplash License, authors in media/credits.json).
// The alt text describes what the photo shows, so a screen-reader user gets the same idea as a sighted one.
export const CATEGORY_PHOTO_ALT = {
  soups: 'Bowl of soup with sliced meat and green onion',
  mains: 'Plate of white rice with a meat and chickpea stew',
  salads: 'Salad bowl with tomatoes, avocado, chickpeas and red cabbage',
  pastries: 'Tray of freshly baked pastries with chocolate',
  drinks: 'Cup of coffee next to a glass of red fruit tea',
  desserts: 'Slices of vanilla layer cake on white plates',
  breakfast: 'Fried egg with slices of bread on a white plate',
  sides: 'Bowl of mashed potatoes topped with chives',
  grill: 'Meat and vegetable skewers on a grill',
  fastfood: 'Burger with lettuce and a cup of French fries',
};

// Banners are cropped to 3:1 and saved as WebP in three widths (_report_tools/optimise_images.mjs).
// The browser picks the smallest file that is still sharp for the screen width and pixel density.
export function categoryPhoto(categoryId) {
  const base = `/img/categories/${categoryId}`;
  return {
    srcSet: `${base}-400.webp 400w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`,
    // banner = page width minus 2 × 16 px padding, at most 992 px (max-w-5xl)
    sizes: '(min-width: 1024px) 992px, calc(100vw - 32px)',
    fallback: `${base}-800.jpg`,
  };
}
