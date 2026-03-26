import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const EVENT_TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Session', value: 'SessionStart,Stop,stop_hook_summary' },
  { label: 'Tools', value: 'PreToolUse,PostToolUse' },
  { label: 'Messages', value: 'user,assistant' },
  { label: 'Progress', value: 'agent_progress,hook_progress' },
];

export function EventFilterBar() {
  const { activeEventTypes, setActiveEventTypes, searchQuery, setSearchQuery } = useUIStore();

  const activeFilter = activeEventTypes.length === 0 ? '' : activeEventTypes.join(',');

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
      <div className="flex items-center gap-1">
        {EVENT_TYPE_FILTERS.map((filter) => (
          <button
            key={filter.label}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs transition-colors',
              activeFilter === filter.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            )}
            onClick={() =>
              setActiveEventTypes(filter.value ? filter.value.split(',') : [])
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="relative w-48">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 pl-7 text-xs"
        />
      </div>
    </div>
  );
}
