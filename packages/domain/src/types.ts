/* Shapes of data/catalog.json. Money is always an integer amount of cents. */

export type RecordStatus = 'observed' | 'conflicting' | 'approved' | 'demo' | 'pending';

export interface Image {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface StoreInfo {
  topic: string;
  label: string;
  value: string | null;
  href?: string;
  status: RecordStatus;
  sources: string[];
  note?: string;
  observations?: string[];
}

export interface Store {
  name: string;
  displayName: string;
  tagline: string;
  logo: Image;
  info: StoreInfo[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Flavor {
  id: string;
  name: string;
  kind: 'salgada' | 'doce';
  ingredients: string[] | null;
  prices: Record<string, number>;
  status: Record<string, RecordStatus>;
  sources: string[];
  productId?: string;
  note?: string;
}

export interface Option {
  id: string;
  name: string;
  priceCents: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  status: RecordStatus;
  sources: string[];
  options: Option[];
}

export type PricingPolicy =
  | { type: 'fixed'; priceCents: number }
  | { type: 'fraction_sum'; table: string; status?: RecordStatus }
  | { type: 'unknown' };

export interface FlavorRule {
  min: number;
  max: number;
  table: string;
  options: string[];
}

/* Options are flavor ids ("flavor") or variant ids of another product
   ("item", such as a drink or an esfiha). repeat allows several units of the
   same option; otherwise each one is taken at most once. */
export interface ComboGroup {
  id: string;
  label: string;
  hint: string;
  source: 'flavor' | 'item';
  repeat: boolean;
  min: number;
  max: number;
  table?: string;
  options: string[];
  status: RecordStatus;
}

export interface Variant {
  id: string;
  label: string;
  slices?: number;
  pricing: PricingPolicy;
  description?: string;
  ingredients?: string[] | null;
  image?: Image;
  flavors?: FlavorRule;
  optionGroupIds?: string[];
  comboGroups?: ComboGroup[];
  status: RecordStatus;
  sources: string[];
  alternateSources?: string[];
  note?: string;
}

export type ProductKind = 'pizza' | 'builder' | 'combo' | 'simple';

export interface Product {
  id: string;
  slug: string;
  name: string;
  kind: ProductKind;
  unit?: string;
  /* What the variants mean to the customer: Tamanho, Sabor or Bebida. */
  variantLabel?: string;
  image?: Image;
  categoryIds: string[];
  summary?: string;
  featured?: boolean;
  status: RecordStatus;
  variants: Variant[];
}

export interface SourceRecord {
  id: string;
  channel: string;
  url: string;
  observedOn: string;
  field: string;
  observedValue?: string;
  note?: string;
}

export interface Promotion {
  id: string;
  productId: string;
  title: string;
  image: Image;
  status: RecordStatus;
  sources: string[];
  note?: string;
}

export interface Catalog {
  version: string;
  currency: 'BRL';
  store: Store;
  categories: Category[];
  flavors: Flavor[];
  optionGroups: OptionGroup[];
  products: Product[];
  promotions: Promotion[];
  sources: SourceRecord[];
}

/* What the customer chose for one cart line. Combo selections map a group id
   to the chosen option ids and how many units of each. */
export interface LineConfig {
  productId: string;
  variantId: string;
  quantity: number;
  flavorIds?: string[];
  optionIds?: string[];
  /* Listed ingredients the customer asked to leave out. */
  removedIngredients?: string[];
  combo?: Record<string, Record<string, number>>;
  note?: string;
}

export type IssueField = 'product' | 'variant' | 'quantity' | 'flavors' | 'options' | 'ingredients' | 'combo' | 'note' | 'price';

export interface LineIssue {
  field: IssueField;
  code: string;
  message: string;
  groupId?: string;
}

export interface PricePart {
  label: string;
  cents: number;
}

export interface LineQuote {
  ok: boolean;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  quantity: number;
  unitCents: number | null;
  totalCents: number | null;
  parts: PricePart[];
  summary: string[];
  issues: LineIssue[];
}

export interface Quote {
  id: string;
  catalogVersion: string;
  currency: 'BRL';
  lines: LineQuote[];
  subtotalCents: number;
  deliveryCents: number | null;
  totalCents: number;
  complete: boolean;
  createdAt: string;
  expiresAt: string;
  warnings: string[];
}
