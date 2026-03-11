import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface SortableWidgetProps {
  id: string;
  children: ReactNode;
  label: string;
  dragEnabled?: boolean;
}

export function SortableWidget({ id, children, label, dragEnabled = false }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !dragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  if (!dragEnabled) {
    return <div id={`widget-${id}`} tabIndex={-1} className="outline-none">{children}</div>;
  }

  return (
    <div
      id={`widget-${id}`}
      ref={setNodeRef}
      style={style}
      tabIndex={-1}
      className={`group/widget outline-none ${isDragging ? "opacity-60 scale-[0.98] ring-2 ring-primary/30 rounded-2xl" : ""}`}
    >
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-12 rounded-lg bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/widget:opacity-100 hover:!opacity-100 focus-visible:opacity-100 transition-opacity print:hidden"
        aria-label={`Déplacer le widget ${label}`}
        aria-roledescription="poignée de déplacement"
        role="button"
        tabIndex={0}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
