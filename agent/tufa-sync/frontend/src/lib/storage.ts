// localStorage can be unavailable (private mode, blocked site data); preferences are optional.
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove when storage is unavailable.
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Nothing to do: the preference is simply not remembered.
    }
  },
};
