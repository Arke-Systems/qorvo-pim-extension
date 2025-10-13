export type ProductSummary = {
  id: string;
  sku: string;
  name: string;
  description?: string; // plain text (HTML stripped)
  category?: string;    // primary category (first in list)
  categories?: string[]; // all categories
  thumbnailUrl?: string;
  [key: string]: any;
};

export type PIMSearchResponse = {
  total: number;
  items: ProductSummary[];
};
