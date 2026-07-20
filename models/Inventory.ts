export type Inventory = {
  id: number;
  itemId: number;
  name: string;
  description: string | null;
  type: string | null;
  typeId: number | null;
  createdDate: string | null;
  qtyOnHand: number;
  actualQty: number | null;
  // Date the actualQty count was taken. Lets on-hand math look back to the
  // real last-count date instead of assuming it was always "yesterday".
  actualQtyDate: string | null;
  uom: string | null;
  uomId: number | null;
  packSize: number | null;
};
