'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type DataPoint = { [key: string]: number | string };

type LineChartProps = {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  lineColor?: string;
  fillColor?: string;
};

const LineChart: React.FC<LineChartProps> = ({ data, xKey, yKey, lineColor = '#f97316', fillColor = '#f97316' }) => {
  const [textColor, setTextColor] = useState<string>('#111');

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
    if (color) setTextColor(color.trim());
  }, []);

  const labels = useMemo(() => data.map((item) => String(item[xKey] ?? '')), [data, xKey]);
  const values = useMemo(() => data.map((item) => Number(item[yKey] ?? 0)), [data, yKey]);

  if (!data || data.length === 0) {
    return <div className='flex items-center justify-center h-full text-gray-500'>No data to display.</div>;
  }

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        borderColor: lineColor,
        backgroundColor: `${fillColor}33`,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (ctx: any) => `${ctx.raw ?? ctx.parsed?.y ?? 0}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: textColor,
          maxRotation: 0,
          autoSkip: true,
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
      },
    },
  };

  return (
    <div className='w-full h-full'>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default LineChart;
