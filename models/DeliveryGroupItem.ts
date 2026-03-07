export type DeliveryGroupItem = {
  key: string;
  supplierId: number | null;
  supplierName: string;
  total: number;
  status: string;
  items: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unitName: string;
    price: number;
    total: number;
  }>;
};
