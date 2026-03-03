'use client';

import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type DataPoint = { label: string; value: number };

const DEFAULT_BAR_COLOR = '#3b82f6';

export default function BarGraph({
  data,
  barColor,
  horizontal = true,
  height = 300,
}: {
  data: DataPoint[];
  barColor?: string;
  horizontal?: boolean;
  height?: number;
}) {
  const [textColor, setTextColor] = useState<string>('#111');

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
    if (color) setTextColor(color.trim());
  }, []);

  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: '',
        data: values,
        backgroundColor: barColor ?? DEFAULT_BAR_COLOR,
        borderRadius: 6,
      },
    ],
  };

  const options: any = {
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (ctx: any) => `${ctx.raw ?? ctx.parsed}`,
        },
      },
      title: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          callback: function (val: any) {
            return typeof val === 'number' ? `${val}` : val;
          },
        },
      },
      y: {
        ticks: {
          color: textColor,
          autoSkip: false,
        },
      },
    },
    layout: { padding: 6 },
  };

  return (
    <div style={{ height }} className='w-full'>
      <Bar data={chartData} options={options} />
    </div>
  );
}
