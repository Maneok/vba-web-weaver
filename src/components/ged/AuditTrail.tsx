import { useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { getActionLabel, type AuditEntry } from '@/services/gedAuditService';

interface AuditTrailProps {
  entries: AuditEntry[];
  loading: boolean;
  title?: string;
}

const ACTION_DOT_COLORS: Record<string, string> = {
  upload: 'bg-emerald-500',
  validate: 'bg-emerald-500',
  download: 'bg-blue-500',
  preview: 'bg-blue-500',
  delete: 'bg-red-500',
  reject: 'bg-red-500',
  rename: 'bg-amber-500',
  replace: 'bg-amber-500',
  category_change: 'bg-amber-500',
  tag_change: 'bg-amber-500',
};

function formatAuditDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true, locale: fr });
  if (isYesterday(d)) return `hier à ${format(d, 'HH:mm', { locale: fr })}`;
  return format(d, 'd MMM yyyy', { locale: fr });
}

export default function AuditTrail({ entries, loading, title = 'Historique' }: AuditTrailProps) {
  const [visibleCount, setVisibleCount] = useState(20);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          {title}
        </h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <History className="h-4 w-4" />
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">Aucune activité enregistrée</p>
      </div>
    );
  }

  const visible = entries.slice(0, visibleCount);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <History className="h-4 w-4" />
        {title}
      </h3>
      <div className="max-h-[400px] overflow-y-auto space-y-0">
        {visible.map((entry, idx) => {
          const dotColor = ACTION_DOT_COLORS[entry.action] || 'bg-muted-foreground';
          const docName = (entry.details as Record<string, unknown>)?.document_name as string || '';
          const detail = (entry.details as Record<string, unknown>)?.reason as string
            || (entry.details as Record<string, unknown>)?.old_name as string
            || '';
          const isLast = idx === visible.length - 1;

          return (
            <div key={entry.id} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
              )}
              {/* Dot */}
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />
              {/* Content */}
              <div className="min-w-0 pb-4">
                <p className="text-sm leading-snug">
                  <span className="font-medium">{entry.actor_name}</span>{' '}
                  <span className="text-muted-foreground">{getActionLabel(entry.action)}</span>
                  {docName && <span className="font-medium"> {docName}</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatAuditDate(entry.created_at)}
                </p>
                {detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    {detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {entries.length > visibleCount && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs"
          onClick={() => setVisibleCount(prev => prev + 20)}
        >
          Voir plus ({entries.length - visibleCount} restants)
        </Button>
      )}
    </div>
  );
}
