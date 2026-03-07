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
  uom: string | null;
  uomId: number | null;
  packSize: number | null;
};
