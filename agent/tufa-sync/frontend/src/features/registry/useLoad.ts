import { useCallback, useEffect, useRef, useState } from "react";
import { useApi, type ApiCall } from "../session/context";

/** Runs `load` when first shown and on `reload`, keeping its result, loading state and error. */
export function useLoad<T>(load: (call: ApiCall) => Promise<T>) {
  const call = useApi();
  const loader = useRef(load);
  loader.current = load;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader.current(call));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [call]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, loading, error, reload };
}
