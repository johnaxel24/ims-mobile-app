import { createStock, localToday, normalizeLocations } from './inventory.logic';
import type { CreateStockInput, InventorySnapshot } from './inventory.types';

interface SampleStock extends Omit<CreateStockInput, 'inventoryDate' | 'notes'> {
  readonly sampleId: string;
}

const SAMPLE_STOCKS: readonly SampleStock[] = [
  { sampleId: 'rice', name: 'Jasmine rice', quantity: 24, location: 'Shelf A', costPerUnitMinor: 5600, measurementPerUnit: '1 kg', quantityAlertThreshold: 5 },
  { sampleId: 'tuna', name: 'Canned tuna', quantity: 5, location: 'Shelf A', costPerUnitMinor: 3500, measurementPerUnit: '155 g', quantityAlertThreshold: 5 },
  { sampleId: 'noodles', name: 'Instant noodles', quantity: 3, location: 'Shelf B', costPerUnitMinor: 1200, measurementPerUnit: '65 g', quantityAlertThreshold: 10 },
  { sampleId: 'water', name: 'Bottled water', quantity: 0, location: 'Drinks rack', costPerUnitMinor: 1000, measurementPerUnit: '500 mL', quantityAlertThreshold: 12 },
  { sampleId: 'oil', name: 'Cooking oil', quantity: 8, location: 'Shelf B', costPerUnitMinor: 9500, measurementPerUnit: '1 L', quantityAlertThreshold: 3 },
  { sampleId: 'soap', name: 'Laundry soap', quantity: 18, location: 'Cleaning shelf', quantityAlertThreshold: 4 },
  { sampleId: 'biscuits', name: 'Butter biscuits', quantity: 12, location: 'Shelf A', costPerUnitMinor: 1800, measurementPerUnit: '100 g', quantityAlertThreshold: 5 },
  { sampleId: 'coffee', name: 'Coffee sachets', quantity: 40, location: 'Counter', costPerUnitMinor: 600, measurementPerUnit: '20 g', quantityAlertThreshold: 10 },
];

/** Merge samples once without overwriting existing records or changing edited samples. */
export function seedDemoInventory(snapshot: InventorySnapshot, now = new Date()): InventorySnapshot {
  if (snapshot.demoSeeded === true) return snapshot;

  const existingIds = new Set(snapshot.stocks.map((stock) => stock.id));
  const samples = SAMPLE_STOCKS.flatMap((sample, index) => {
    const id = `demo-v1-${sample.sampleId}`;
    if (existingIds.has(id)) return [];
    // Samples predate new user entries and have distinct timestamps for useful sorting demos.
    const createdAt = new Date(now.getTime() - (SAMPLE_STOCKS.length - index) * 86_400_000);
    const location = snapshot.locations.find((name) => name.toLocaleLowerCase() === sample.location.toLocaleLowerCase()) ?? sample.location;
    return [createStock({
      name: sample.name,
      quantity: sample.quantity,
      location,
      costPerUnitMinor: sample.costPerUnitMinor,
      measurementPerUnit: sample.measurementPerUnit,
      quantityAlertThreshold: sample.quantityAlertThreshold,
      inventoryDate: localToday(createdAt),
      notes: 'Sample stock for the demo. You can edit its details and most recently received date.',
    }, id, createdAt.toISOString())];
  });

  return {
    ...snapshot,
    stocks: [...snapshot.stocks, ...samples],
    locations: normalizeLocations([...snapshot.locations, ...samples.map((stock) => stock.location)]),
    demoSeeded: true,
  };
}
