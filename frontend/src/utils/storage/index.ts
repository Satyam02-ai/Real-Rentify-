import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// SecureStore for sensitive values (tokens), AsyncStorage for everything else.
const SECURE_KEYS = new Set(["access_token"]);

export async function getItem(key: string): Promise<string | null> {
  if (SECURE_KEYS.has(key)) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (SECURE_KEYS.has(key)) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (SECURE_KEYS.has(key)) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}
