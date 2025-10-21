export type ProductSummary = {
  id: string;
  description?: string;
  category?: string;
  categories?: string[];
  thumbnailUrl?: string;
  uuid?: string;
  partNumber?: string;
  productType?: { UUID?: string; Name?: string } | null;
  [key: string]: any;
};

export type PIMSearchResponse = {
  total: number;
  items: ProductSummary[];
};
