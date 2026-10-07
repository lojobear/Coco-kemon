import React from 'react';

/**
 * Shimmering placeholder mirroring the archive grid card layout
 * (art box + name / classification / meta lines). Not wired into any
 * view — the Archive batch owns that integration.
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card ${className}`} aria-hidden="true">
      <div className="skeleton skeleton-card-art" />
      <div className="skeleton skeleton-card-line skeleton-card-line-name" />
      <div className="skeleton skeleton-card-line skeleton-card-line-sub" />
      <div className="skeleton skeleton-card-line skeleton-card-line-meta" />
    </div>
  );
}