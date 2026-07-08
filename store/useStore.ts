import { Delivery } from "@/models/Delivery";
import { Inventory } from "@/models/Inventory";
import { Item } from "@/models/Item";
import { ItemType } from "@/models/ItemType";
import { PaymentMode } from "@/models/PaymentMode";
import { SaleToday } from "@/models/SaleToday";
import { Supplier } from "@/models/Supplier";
import { Uom } from "@/models/Uom";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type StoreState = {
  items: Item[];
  itemTypes: ItemType[];
  inventories: Inventory[];
  deliveries: Delivery[];
  suppliers: Supplier[];
  uoms: Uom[];
  paymentModes: PaymentMode[];
  salesToday: SaleToday[];
  supplierItems: Record<number, number[]>;
  setItems: (items: Item[]) => void;
  setItemTypes: (itemTypes: ItemType[]) => void;
  setInventories: (inventories: Inventory[]) => void;
  setDeliveries: (deliveries: Delivery[]) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  setUoms: (uoms: Uom[]) => void;
  setPaymentModes: (modes: PaymentMode[]) => void;
  updatePaymentMode: (mode: PaymentMode) => void;
  removePaymentMode: (id: number) => void;
  setSalesToday: (dbSales: SaleToday[]) => void;
  addSalesToday: (sales: SaleToday[]) => void;
  removeSalesByIds: (saleIds: number[]) => void;
  markSaleForDeletion: (saleId: number) => void;
  undoSaleDeletion: (saleId: number) => void;
  clearDeletedSales: () => void;
  clearUnsyncedSales: () => void;
  setSupplierItems: (map: Record<number, number[]>) => void;
  updateItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateItemType: (itemType: ItemType) => void;
  removeItemType: (id: number) => void;
  updateSupplier: (supplier: Supplier) => void;
  removeSupplier: (id: number) => void;
  updateUom: (uom: Uom) => void;
  removeUom: (id: number) => void;
};

export const useStore = create<StoreState>()(
  persist(
    immer((set) => ({
      items: [],
      itemTypes: [],
      inventories: [],
      deliveries: [],
      suppliers: [],
      uoms: [],
      paymentModes: [],
      salesToday: [],
      supplierItems: {},
      setItems: (items) => {
        set((state) => {
          state.items = items;
        });
      },
      setItemTypes: (itemTypes) => {
        set((state) => {
          state.itemTypes = itemTypes;
        });
      },
      setInventories: (inventories) => {
        set((state) => {
          state.inventories = inventories;
        });
      },
      setDeliveries: (deliveries) => {
        set((state) => {
          state.deliveries = deliveries;
        });
      },
      setSuppliers: (suppliers) => {
        set((state) => {
          state.suppliers = suppliers;
        });
      },
      setUoms: (uoms) => {
        set((state) => {
          state.uoms = uoms;
        });
      },
      setPaymentModes: (modes) => {
        set((state) => {
          state.paymentModes = modes;
        });
      },
      updatePaymentMode: (mode) => {
        set((state) => {
          const index = state.paymentModes.findIndex((m) => m.id === mode.id);
          if (index !== -1) {
            state.paymentModes[index] = mode;
          } else {
            state.paymentModes.push(mode);
          }
        });
      },
      removePaymentMode: (id) => {
        set((state) => {
          state.paymentModes = state.paymentModes.filter((m) => m.id !== id);
        });
      },
      setSalesToday: (dbSales) => {
        set((state) => {
          const unsynced = state.salesToday
            .filter((s) => s.synced === false)
            .map((s) => ({ ...s }));
          const pendingDeleteIds = new Set(
            state.salesToday
              .filter((s) => s.pendingDelete === true)
              .map((s) => s.id),
          );
          state.salesToday = [
            ...dbSales.map((s) => ({
              ...s,
              synced: true as boolean,
              ...(pendingDeleteIds.has(s.id) ? { pendingDelete: true } : {}),
            })),
            ...unsynced,
          ];
        });
      },
      addSalesToday: (newSales) => {
        set((state) => {
          state.salesToday = [...newSales, ...state.salesToday];
        });
      },
      removeSalesByIds: (saleIds) => {
        set((state) => {
          const idsToRemove = new Set(saleIds);
          state.salesToday = state.salesToday.filter(
            (sale) => !idsToRemove.has(sale.id),
          );
        });
      },
      clearUnsyncedSales: () => {
        set((state) => {
          state.salesToday = state.salesToday.filter((s) => s.synced !== false);
        });
      },
      markSaleForDeletion: (saleId) => {
        set((state) => {
          if (saleId < 0) {
            // Never persisted to DB — remove immediately
            state.salesToday = state.salesToday.filter((s) => s.id !== saleId);
          } else {
            const idx = state.salesToday.findIndex((s) => s.id === saleId);
            if (idx !== -1) state.salesToday[idx].pendingDelete = true;
          }
        });
      },
      undoSaleDeletion: (saleId) => {
        set((state) => {
          const idx = state.salesToday.findIndex((s) => s.id === saleId);
          if (idx !== -1) delete state.salesToday[idx].pendingDelete;
        });
      },
      clearDeletedSales: () => {
        set((state) => {
          state.salesToday = state.salesToday.filter((s) => !s.pendingDelete);
        });
      },
      setSupplierItems: (map) => {
        set((state) => {
          state.supplierItems = map;
        });
      },
      updateItem: (item) => {
        set((state) => {
          const index = state.items.findIndex((i) => i.id === item.id);
          if (index !== -1) {
            state.items[index] = item;
          } else {
            state.items.push(item);
          }
        });
      },
      removeItem: (itemId) => {
        set((state) => {
          state.items = state.items.filter((i) => i.id !== itemId);
        });
      },
      updateItemType: (itemType) => {
        set((state) => {
          const index = state.itemTypes.findIndex((i) => i.id === itemType.id);
          if (index !== -1) {
            state.itemTypes[index] = itemType;
          } else {
            state.itemTypes.push(itemType);
          }
        });
      },
      removeItemType: (id) => {
        set((state) => {
          state.itemTypes = state.itemTypes.filter((i) => i.id !== id);
        });
      },
      updateSupplier: (supplier) => {
        set((state) => {
          const index = state.suppliers.findIndex((s) => s.id === supplier.id);
          if (index !== -1) {
            state.suppliers[index] = supplier;
          } else {
            state.suppliers.push(supplier);
          }
        });
      },
      removeSupplier: (id) => {
        set((state) => {
          state.suppliers = state.suppliers.filter((s) => s.id !== id);
        });
      },
      updateUom: (uom) => {
        set((state) => {
          const index = state.uoms.findIndex((u) => u.id === uom.id);
          if (index !== -1) {
            state.uoms[index] = uom;
          } else {
            state.uoms.push(uom);
          }
        });
      },
      removeUom: (id) => {
        set((state) => {
          state.uoms = state.uoms.filter((u) => u.id !== id);
        });
      },
    })),
    {
      name: "etindahan-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
