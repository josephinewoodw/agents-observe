import { useUIStore } from '@/stores/ui-store';
import { ScopeBar } from './scope-bar';
import { EventFilterBar } from './event-filter-bar';

export function MainPanel() {
  const { selectedProjectId } = useUIStore();

  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a project to get started
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ScopeBar />
      <EventFilterBar />
      {/* ActivityTimeline and EventStream will be added in Tasks 10-11 */}
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Event stream coming next...
      </div>
    </div>
  );
}
