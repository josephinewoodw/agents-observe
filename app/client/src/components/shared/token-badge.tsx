import { cn } from '@/lib/utils'
import { formatTokenCount } from '@/lib/usage-utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Zap } from 'lucide-react'

interface TokenBadgeProps {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  totalDurationMs?: number
  className?: string
  compact?: boolean
}

export function TokenBadge({
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
  totalDurationMs,
  className,
  compact = false,
}: TokenBadgeProps) {
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens

  if (totalTokens === 0) return null

  const tooltipContent = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
      <span className="text-muted-foreground">Input:</span>
      <span className="text-right font-mono">{inputTokens.toLocaleString()}</span>
      <span className="text-muted-foreground">Output:</span>
      <span className="text-right font-mono">{outputTokens.toLocaleString()}</span>
      {cacheReadTokens > 0 && (
        <>
          <span className="text-muted-foreground">Cache read:</span>
          <span className="text-right font-mono">{cacheReadTokens.toLocaleString()}</span>
        </>
      )}
      {cacheCreationTokens > 0 && (
        <>
          <span className="text-muted-foreground">Cache create:</span>
          <span className="text-right font-mono">{cacheCreationTokens.toLocaleString()}</span>
        </>
      )}
      <span className="text-muted-foreground font-medium border-t border-border pt-0.5 mt-0.5">Total:</span>
      <span className="text-right font-mono font-medium border-t border-border pt-0.5 mt-0.5">{totalTokens.toLocaleString()}</span>
      {totalDurationMs != null && totalDurationMs > 0 && (
        <>
          <span className="text-muted-foreground">Duration:</span>
          <span className="text-right font-mono">
            {totalDurationMs >= 60_000
              ? `${(totalDurationMs / 60_000).toFixed(1)}m`
              : `${(totalDurationMs / 1_000).toFixed(1)}s`}
          </span>
        </>
      )}
    </div>
  )

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/70 dark:text-muted-foreground/50 font-mono',
              className,
            )}
          >
            <Zap className="h-2.5 w-2.5" />
            {formatTokenCount(totalTokens)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs text-muted-foreground font-mono',
            className,
          )}
        >
          <Zap className="h-3 w-3" />
          {formatTokenCount(totalTokens)} tokens
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  )
}
