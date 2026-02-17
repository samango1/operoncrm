'use client';

import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

type PieDatum = { label: string; value: number; color?: string };

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];

export default function PieChart({
  data,
  size = 220,
  showLegend = true,
}: {
  data: PieDatum[];
  size?: number;
  showLegend?: boolean;
}) {
  const [textColor, setTextColor] = useState<string>('#111');

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
    if (color) setTextColor(color.trim());
  }, []);

  const labels = data.map((d) => d.label);
  const backgroundColor = data.map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor,
        borderWidth: 0,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'right' as const,
        labels: { boxWidth: 12, padding: 8, color: textColor },
      },
      tooltip: {
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw ?? ctx.parsed;
            return `${ctx.label}: ${val}`;
          },
        },
      },
    },
    layout: { padding: 8 },
  };

  return (
    <div style={{ width: size, height: size, minWidth: size }} className='relative'>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}
