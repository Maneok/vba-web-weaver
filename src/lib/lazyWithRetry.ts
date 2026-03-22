import { type ComponentType } from "react";

/** Retry a dynamic import up to 2 times with a reload on final failure (handles stale deployments) */
export function lazyRetry<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>,
): Promise<T> {
  return factory().catch(() =>
    new Promise<T>((resolve) => setTimeout(resolve, 500)).then(() =>
      factory().catch(() => {
        const key = "chunk-reload-" + window.location.pathname;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        }
        return factory();
      })
    )
  );
}
