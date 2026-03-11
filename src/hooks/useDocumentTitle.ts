import { useEffect, useRef } from "react";

const SUFFIX = "GRIMY";

/** OPT-25: Sets document.title on mount, restores on unmount. */
export function useDocumentTitle(title: string) {
  const prevTitleRef = useRef(document.title);

  useEffect(() => {
    const prev = prevTitleRef.current;
    document.title = title.includes(SUFFIX) ? title : `${title} | ${SUFFIX}`;
    return () => { document.title = prev; };
  }, [title]);
}
