"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Calendar,
  ShieldAlert,
  Plus,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelaySeconds: number;
  retryOnBusy: boolean;
  retryOnNoAnswer: boolean;
  retryOnVoicemail: boolean;
}

export interface TimeSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  timezone: string;
  slots: TimeSlot[];
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  windowSeconds: number;
  minCallsInWindow: number;
}

export interface AdvancedConfig {
  maxConcurrency: number;
  retry: RetryConfig;
  schedule: ScheduleConfig;
  circuitBreaker: CircuitBreakerConfig;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
  maxConcurrency: 5,
  retry: {
    enabled: true,
    maxRetries: 2,
    retryDelaySeconds: 120,
    retryOnBusy: true,
    retryOnNoAnswer: true,
    retryOnVoicemail: false,
  },
  schedule: {
    enabled: true,
    timezone: "Asia/Kolkata",
    slots: [
      { dayOfWeek: 1, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 2, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 3, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 4, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 5, startTime: "10:00", endTime: "19:00" },
    ],
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 50,
    windowSeconds: 120,
    minCallsInWindow: 5,
  },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  value: AdvancedConfig;
  onChange: (value: AdvancedConfig) => void;
}

export default function CampaignAdvancedSettings({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function update(patch: Partial<AdvancedConfig>) {
    onChange({ ...value, ...patch });
  }

  function updateRetry(patch: Partial<RetryConfig>) {
    onChange({ ...value, retry: { ...value.retry, ...patch } });
  }

  function updateSchedule(patch: Partial<ScheduleConfig>) {
    onChange({ ...value, schedule: { ...value.schedule, ...patch } });
  }

  function updateCircuitBreaker(patch: Partial<CircuitBreakerConfig>) {
    onChange({
      ...value,
      circuitBreaker: { ...value.circuitBreaker, ...patch },
    });
  }

  function addSlot() {
    const usedDays = new Set(value.schedule.slots.map((s) => s.dayOfWeek));
    const nextDay = [1, 2, 3, 4, 5, 6, 0].find((d) => !usedDays.has(d)) ?? 0;
    updateSchedule({
      slots: [
        ...value.schedule.slots,
        { dayOfWeek: nextDay, startTime: "10:00", endTime: "19:00" },
      ],
    });
  }

  function removeSlot(index: number) {
    updateSchedule({
      slots: value.schedule.slots.filter((_, i) => i !== index),
    });
  }

  function updateSlot(index: number, patch: Partial<TimeSlot>) {
    const slots = value.schedule.slots.map((s, i) =>
      i === index ? { ...s, ...patch } : s
    );
    updateSchedule({ slots });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced settings
        </span>
        {!open && (
          <span className="text-xs text-muted-foreground/60">
            {value.retry.enabled ? `${value.retry.maxRetries} retries` : "no retries"}
            {" · "}
            {value.schedule.enabled
              ? `${value.schedule.slots.length} day${value.schedule.slots.length !== 1 ? "s" : ""}`
              : "no schedule"}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-6 pt-3">
          {/* ── Max Concurrency ── */}
          <div className="space-y-2">
            <Label>Max concurrent calls</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={value.maxConcurrency}
              onChange={(e) =>
                update({
                  maxConcurrency: Math.max(
                    1,
                    Math.min(100, Number(e.target.value))
                  ),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              How many calls can run simultaneously (limited by your plan)
            </p>
          </div>

          {/* ── Retry Config ── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Retry failed calls</Label>
              </div>
              <Switch
                checked={value.retry.enabled}
                onCheckedChange={(checked: boolean) =>
                  updateRetry({ enabled: checked })
                }
              />
            </div>

            {value.retry.enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Max retries</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={value.retry.maxRetries}
                      onChange={(e) =>
                        updateRetry({ maxRetries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Delay between retries</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={value.retry.retryDelaySeconds}
                      onChange={(e) =>
                        updateRetry({
                          retryDelaySeconds: Number(e.target.value),
                        })
                      }
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={120}>2 minutes</option>
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                      <option value={1800}>30 minutes</option>
                      <option value={3600}>1 hour</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Retry when:
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-sm">
                      <span>No answer</span>
                      <Switch
                        checked={value.retry.retryOnNoAnswer}
                        onCheckedChange={(checked: boolean) =>
                          updateRetry({ retryOnNoAnswer: checked })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      <span>Line busy</span>
                      <Switch
                        checked={value.retry.retryOnBusy}
                        onCheckedChange={(checked: boolean) =>
                          updateRetry({ retryOnBusy: checked })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      <span>Voicemail reached</span>
                      <Switch
                        checked={value.retry.retryOnVoicemail}
                        onCheckedChange={(checked: boolean) =>
                          updateRetry({ retryOnVoicemail: checked })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Schedule Config ── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Calling schedule</Label>
              </div>
              <Switch
                checked={value.schedule.enabled}
                onCheckedChange={(checked: boolean) =>
                  updateSchedule({ enabled: checked })
                }
              />
            </div>

            {value.schedule.enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                <div className="space-y-1">
                  <Label className="text-xs">Timezone</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={value.schedule.timezone}
                    onChange={(e) =>
                      updateSchedule({ timezone: e.target.value })
                    }
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Time slots</Label>
                    {value.schedule.slots.length < 7 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={addSlot}
                      >
                        <Plus className="h-3 w-3" /> Add day
                      </Button>
                    )}
                  </div>

                  {value.schedule.slots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        className="rounded-md border bg-background px-2 py-1.5 text-sm w-20"
                        value={slot.dayOfWeek}
                        onChange={(e) =>
                          updateSlot(i, {
                            dayOfWeek: Number(e.target.value),
                          })
                        }
                      >
                        {DAY_LABELS.map((label, d) => (
                          <option key={d} value={d}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="time"
                        className="flex-1"
                        value={slot.startTime}
                        onChange={(e) =>
                          updateSlot(i, { startTime: e.target.value })
                        }
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className="flex-1"
                        value={slot.endTime}
                        onChange={(e) =>
                          updateSlot(i, { endTime: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSlot(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {value.schedule.slots.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No schedule — calls go out anytime. Add days to restrict.
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  NDNC guideline: calls only between 10 AM – 7 PM.
                </p>
              </div>
            )}
          </div>

          {/* ── Circuit Breaker ── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">
                  Auto-pause on high failure
                </Label>
              </div>
              <Switch
                checked={value.circuitBreaker.enabled}
                onCheckedChange={(checked: boolean) =>
                  updateCircuitBreaker({ enabled: checked })
                }
              />
            </div>

            {value.circuitBreaker.enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                <div className="space-y-1">
                  <Label className="text-xs">
                    Failure threshold (%)
                  </Label>
                  <Input
                    type="number"
                    min={10}
                    max={100}
                    value={value.circuitBreaker.failureThreshold}
                    onChange={(e) =>
                      updateCircuitBreaker({
                        failureThreshold: Number(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Pause if more than {value.circuitBreaker.failureThreshold}%
                    of calls fail
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Window (seconds)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      value={value.circuitBreaker.windowSeconds}
                      onChange={(e) =>
                        updateCircuitBreaker({
                          windowSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min calls to trigger</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={value.circuitBreaker.minCallsInWindow}
                      onChange={(e) =>
                        updateCircuitBreaker({
                          minCallsInWindow: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
