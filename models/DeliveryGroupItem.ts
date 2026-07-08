import { DeliveryPayment } from "./Delivery";

export type DeliveryGroupItem = {
  key: string;
  deliveryId: number;
  supplierId: number | null;
  supplierName: string;
  total: number;
  isPaid: boolean;
  payments: DeliveryPayment[];
  items: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unitName: string;
    price: number;
    total: number;
  }>;
};
