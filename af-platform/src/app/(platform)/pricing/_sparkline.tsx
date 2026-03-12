'use client';

import { useState, useRef } from 'react';
import type { MonthBucket } from './_types';
import type { RateDetail, SurchargeItem } from '@/app/actions/pricing';
import { formatCompact, formatDate } from './_helpers';

export function CostSparkline({
  monthMap,
  months,
  color = '#ef4444',
  surchargesMap,
  endDateMap,
  startDateMap,
  dominantRateMap,
  onNodeClick,
}: {
  monthMap: Map<string, { value: number | null; isDraft: boolean }>;
  months: MonthBucket[];
  color?: string;
  surchargesMap?: Map<string, SurchargeItem[] | null>;
  endDateMap?: Map<string, RateDetail>;
  startDateMap?: Map<string, RateDetail>;
  dominantRateMap?: Map<string, RateDetail>;
  onNodeClick?: (rate: RateDetail) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const COL_W = 80;
  const totalW = months.length * COL_W;
  const height = 48;
  const pad = 14;
  const innerH = height - pad * 2;

  const allVals: number[] = [];
  for (const m of months) {
    const v = monthMap.get(m.month_key)?.value;
    if (v != null) allVals.push(v);
  }

  if (allVals.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]/40 px-2">No cost data</span>;
  }

  let minVal = Math.min(...allVals);
  let maxVal = Math.max(...allVals);
  const range = maxVal - minVal;
  minVal -= range * 0.1 || 1;
  maxVal += range * 0.1 || 1;

  const toX = (i: number) => i * COL_W + COL_W / 2;
  const toY = (v: number) =>
    maxVal === minVal ? height / 2 : pad + ((maxVal - v) / (maxVal - minVal)) * innerH;

  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const points: Array<{
    x: number; y: number; value: number; label: string; isCurrent: boolean; monthIdx: number;
  }> = [];

  months.forEach((m, i) => {
    const entry = monthMap.get(m.month_key);
    if (entry?.value != null) {
      points.push({
        x: toX(i),
        y: toY(entry.value),
        value: entry.value,
        label: m.label,
        isCurrent: m.month_key === currentMonthKey,
        monthIdx: i,
      });
    }
  });

  const currentMonthIndex = months.findIndex(m => m.month_key === currentMonthKey);
  const currentX = currentMonthIndex >= 0 ? toX(currentMonthIndex) : -1;

  return (
    <>
      <svg
        ref={svgRef}
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        style={{ display: 'block' }}
      >
        {currentX >= 0 && (
          <line
            x1={currentX} y1={0} x2={currentX} y2={height}
            stroke="#0ea5e9" strokeWidth={1} opacity={0.3}
          />
        )}
        {/* Draw line segments — break where there are null months between two points */}
        {points.length > 1 && (() => {
          const segments: Array<typeof points> = [];
          let current: typeof points = [points[0]];
          for (let i = 1; i < points.length; i++) {
            const prevMonthIdx = points[i - 1].monthIdx;
            const currMonthIdx = points[i].monthIdx;
            let hasGap = currMonthIdx > prevMonthIdx + 1;
            if (hasGap) {
              for (let j = prevMonthIdx + 1; j < currMonthIdx; j++) {
                if ((monthMap.get(months[j].month_key)?.value ?? null) !== null) {
                  hasGap = false;
                  break;
                }
              }
            }
            if (hasGap) {
              segments.push(current);
              current = [points[i]];
            } else {
              current.push(points[i]);
            }
          }
          segments.push(current);
          return segments.map((seg, si) =>
            seg.length > 1 ? (
              <polyline
                key={si}
                points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
              />
            ) : null
          );
        })()}
        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          const sc = surchargesMap?.get(months[p.monthIdx].month_key) ?? null;
          const hasSurcharges = sc != null && sc.length > 0;
          const endDateRate = endDateMap?.get(months[p.monthIdx].month_key);
          const hasEndDate = !!endDateRate;
          const startDateRate = startDateMap?.get(months[p.monthIdx].month_key);
          const hasStartDate = !!startDateRate;
          return (
            <g
              key={i}
              onMouseEnter={() => {
                setHoveredIdx(i);
                const svgRect = svgRef.current?.getBoundingClientRect();
                if (svgRect) {
                  setTooltipCoords({ x: svgRect.left + p.x, y: svgRect.top + p.y });
                }
              }}
              onMouseLeave={() => { setHoveredIdx(null); setTooltipCoords(null); }}
              onClick={() => {
                if (!onNodeClick) return;
                if (hasEndDate) {
                  onNodeClick(endDateRate);
                } else if (hasStartDate) {
                  onNodeClick(startDateRate!);
                } else {
                  const dominant = dominantRateMap?.get(months[p.monthIdx].month_key);
                  if (dominant) onNodeClick(dominant);
                }
              }}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={p.isCurrent ? 4 : isHovered ? 3.5 : 2.5} fill={color} />
              {/* End-date marker — amber tick + diamond (downward) */}
              {hasEndDate && (
                <>
                  <line
                    x1={p.x} y1={p.y + 5}
                    x2={p.x} y2={p.y + 11}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <rect
                    x={p.x - 2.5} y={p.y + 10}
                    width={5} height={5}
                    transform={`rotate(45, ${p.x}, ${p.y + 12.5})`}
                    fill="#f59e0b"
                  />
                </>
              )}
              {/* Start-date marker — amber tick + diamond (upward) */}
              {hasStartDate && (
                <>
                  <line
                    x1={p.x} y1={p.y - 5}
                    x2={p.x} y2={p.y - 11}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <rect
                    x={p.x - 2.5} y={p.y - 15}
                    width={5} height={5}
                    transform={`rotate(45, ${p.x}, ${p.y - 12.5})`}
                    fill="#f59e0b"
                  />
                </>
              )}
              {/* Surcharge indicator — small * above dot when surcharges exist */}
              {hasSurcharges && (
                <text
                  x={p.x + 4}
                  y={p.y - 3}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#0ea5e9"
                  fontWeight="700"
                >
                  *
                </text>
              )}
              {p.isCurrent && (
                <text
                  x={Math.max(20, Math.min(p.x, totalW - 20))}
                  y={Math.max(p.y - 6, 10)}
                  textAnchor="middle"
                  fontSize="8"
                  fill={color}
                  fontWeight="600"
                >
                  {formatCompact(p.value + (surchargesMap?.get(months[p.monthIdx].month_key)?.reduce((s, x) => s + x.amount, 0) ?? 0))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hoveredIdx !== null && tooltipCoords !== null && (() => {
        const p = points[hoveredIdx];
        const sc = surchargesMap?.get(months[p.monthIdx].month_key) ?? null;
        const total = sc && sc.length > 0 ? p.value + sc.reduce((s, x) => s + x.amount, 0) : null;
        return (
          <div
            style={{
              position: 'fixed',
              top: tooltipCoords.y - 8,
              left: tooltipCoords.x,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 9999,
              whiteSpace: 'nowrap',
            }}
            className="bg-white border border-[var(--border)] rounded shadow-lg px-2 py-1.5 text-[10px] text-[var(--text)]"
          >
            <div className="font-semibold mb-0.5">{p.label}</div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-muted)]">Freight</span>
              <span>{formatCompact(p.value)}</span>
            </div>
            {sc?.map((s, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-[var(--text-muted)]">{s.code}</span>
                <span>{formatCompact(s.amount)}</span>
              </div>
            ))}
            {total != null && sc && sc.length > 0 && (
              <div className="flex justify-between gap-3 border-t border-[var(--border)] mt-0.5 pt-0.5 font-semibold">
                <span>Total</span>
                <span>{formatCompact(total)}</span>
              </div>
            )}
            {endDateMap?.get(months[p.monthIdx].month_key) && (
              <div className="border-t border-[var(--border)] mt-0.5 pt-0.5 text-amber-500 font-medium">
                Ends {formatDate(endDateMap.get(months[p.monthIdx].month_key)!.effective_to!)}
                {' · '}Click to edit
              </div>
            )}
            {startDateMap?.get(months[p.monthIdx].month_key) && (
              <div className="border-t border-[var(--border)] mt-0.5 pt-0.5 text-amber-500 font-medium">
                Starts {formatDate(startDateMap.get(months[p.monthIdx].month_key)!.effective_from!)}
                {' · '}Click to edit
              </div>
            )}
            {!endDateMap?.get(months[p.monthIdx].month_key) &&
             !startDateMap?.get(months[p.monthIdx].month_key) &&
             dominantRateMap?.get(months[p.monthIdx].month_key) &&
             onNodeClick && (
              <div className="border-t border-[var(--border)] mt-0.5 pt-0.5 text-[var(--text-muted)]">
                Click to edit
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
