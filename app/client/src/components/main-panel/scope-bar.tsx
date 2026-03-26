import { useSessions } from '@/hooks/use-sessions';
import { useAgents } from '@/hooks/use-agents';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types';

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ScopeBar() {
  const {
    selectedProjectId,
    selectedSessionId,
    selectedAgentIds,
    setSelectedSessionId,
    removeAgentId,
  } = useUIStore();
  const { data: sessions } = useSessions(selectedProjectId);
  const effectiveSessionId = selectedSessionId || sessions?.[0]?.id || null;
  const { data: agents } = useAgents(effectiveSessionId);

  if (!selectedProjectId) return null;

  const currentSession = sessions?.find((s) => s.id === effectiveSessionId);

  const allAgents: Agent[] = [];
  function collectAgents(list: Agent[] | undefined) {
    list?.forEach((a) => {
      allAgents.push(a);
      if (a.children) collectAgents(a.children);
    });
  }
  collectAgents(agents);

  const visibleAgents =
    selectedAgentIds.length > 0
      ? allAgents.filter((a) => selectedAgentIds.includes(a.id))
      : allAgents;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border min-h-[40px] flex-wrap">
      <span className="text-sm text-muted-foreground">{selectedProjectId}</span>
      <span className="text-muted-foreground/40">/</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-sm">
            {currentSession
              ? `${currentSession.slug || 'Session'} — ${formatRelativeTime(currentSession.startedAt)}`
              : 'Select session'}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setSelectedSessionId(null)}>
            Most recent
          </DropdownMenuItem>
          {sessions?.map((session) => (
            <DropdownMenuItem
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    session.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40'
                  )}
                />
                <span>{session.slug || session.id.slice(0, 8)}</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {formatRelativeTime(session.startedAt)}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground/40">|</span>

      <div className="flex items-center gap-1 flex-wrap">
        {visibleAgents.map((agent) => {
          const isSubagent = agent.parentAgentId !== null;
          return (
            <Badge
              key={agent.id}
              variant="secondary"
              className={cn(
                'gap-1 text-xs cursor-default',
                agent.status === 'active' ? 'border-green-500/30' : ''
              )}
            >
              {isSubagent && <CornerDownRight className="h-2.5 w-2.5" />}
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  agent.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40'
                )}
              />
              {agent.slug || agent.name || agent.id.slice(0, 8)}
              {selectedAgentIds.length > 0 && (
                <button
                  className="ml-0.5 hover:text-foreground"
                  onClick={() => removeAgentId(agent.id)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
