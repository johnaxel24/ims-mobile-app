import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInventoryStorage } from './inventory.persistence';

export const inventoryStorage = createInventoryStorage(AsyncStorage);
