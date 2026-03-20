import { useEffect, useRef } from "react";

const SUFFIX = "GRIMY";

/** OPT-25: Sets document.title on mount, restores on unmount. */
export function useDocumentTitle(title: string, badge?: number) {
  const prevTitleRef = useRef(document.title);

  useEffect(() => {
    const prev = prevTitleRef.current;
    const base = title.includes(SUFFIX) ? title : `${title} | ${SUFFIX}`;
    // OPT-DT1: Show notification count in tab title
    document.title = badge && badge > 0 ? `(${badge}) ${base}` : base;
    return () => { document.title = prev; };
  }, [title, badge]);
}
