import { useEffect } from "react";

const SUFFIX = "GRIMY";

/** Sets document.title on mount. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title.includes(SUFFIX) ? title : `${title} | ${SUFFIX}`;
  }, [title]);
}
