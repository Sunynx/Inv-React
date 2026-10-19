'use client';
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface DepreciationChartProps {
  price: number | string | null | undefined;
  purchaseDate: string | null | undefined;
}

export default function DepreciationChart({ price, purchaseDate }: DepreciationChartProps) {
  const chartData = useMemo(() => {
    if (!price || !purchaseDate) return [];
    const pDate = new Date(purchaseDate);
    const data = [];
    const lifespanYears = 5;
    for (let i = 0; i <= lifespanYears; i++) {
      const yearDate = new Date(pDate.getFullYear() + i, pDate.getMonth(), pDate.getDate());
      const value = Number(price) * (1 - i / lifespanYears);
      data.push({
        year: yearDate.getFullYear().toString(),
        value: value > 0 ? value : 0,
        actualDate: yearDate,
      });
    }
    return data;
  }, [price, purchaseDate]);

  if (!price || !purchaseDate || chartData.length === 0) {
    return null;
  }

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            dy={5}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickFormatter={(val) => `฿${val / 1000}k`}
          />
          <RechartsTooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--card-foreground)',
              fontSize: '12px',
            }}
            formatter={(val: number) => [
              `฿${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              'Book Value',
            ]}
            labelFormatter={(label) => `Year ${label}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
