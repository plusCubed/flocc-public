import React from 'react';

export function StatusIndicator({ status, className, ...props }) {
  const statusToColor = {
    ACTIVE: 'bg-green-500',
    IDLE: 'bg-yellow-500',
    OFFLINE: 'bg-gray-500',
  };
  const statusColor = statusToColor[status];
  return (
    <div
      className={`rounded-full w-2 h-2 ${statusColor} ${className}`}
      {...props}
    />
  );
}
