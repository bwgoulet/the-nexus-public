'use client';

import { useState } from 'react';
import { RiDownloadFill, RiImage2Fill, RiArrowDownSLine } from '@remixicon/react';
import type { TeamGraphics } from '@/lib/data';

type TeamGraphicsRepoProps = {
  graphics: TeamGraphics | null | undefined;
  teamName: string;
  className?: string;
  id?: string;
  collapsible?: boolean;
};

export function TeamGraphicsRepo({ graphics, teamName, className = '', id, collapsible = true }: TeamGraphicsRepoProps) {
  const entries = Object.entries(graphics ?? {}).sort(([, a], [, b]) =>
    b.uploadedAt.localeCompare(a.uploadedAt)
  );
  const [userToggled, setUserToggled] = useState(false);
  const [isCollapsedState, setIsCollapsedState] = useState(false);

  const isCollapsed = userToggled ? isCollapsedState : entries.length === 0;

  const handleHeadingClick = () => {
    if (collapsible) {
      setUserToggled(true);
      setIsCollapsedState(!isCollapsed);
    }
  };

  return (
    <section
      id={id}
      className={`dashboard-panel team-graphics-repo ${className} ${isCollapsed ? 'is-collapsed' : ''}`.trim()}
      aria-labelledby="graphics-repo-title"
    >
      <div
        className="dashboard-section-heading team-graphics-heading"
        onClick={handleHeadingClick}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleHeadingClick();
          }
        }}
      >
        <RiImage2Fill size={28} aria-hidden="true" />
        <div>
          <span>Team media</span>
          <h2 id="graphics-repo-title">GRAPHICS REPOSITORY</h2>
        </div>
        {collapsible ? (
          <button
            type="button"
            className="dashboard-section-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setUserToggled(true);
              setIsCollapsedState(!isCollapsed);
            }}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand Graphics Repository' : 'Collapse Graphics Repository'}
          >
            <RiArrowDownSLine
              size={20}
              className={`dashboard-section-toggle-icon ${isCollapsed ? 'is-collapsed' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      <div className="dashboard-section-body-wrapper">
        <div className="dashboard-section-body-inner">
          {entries.length === 0 ? (
            <div className="team-graphics-empty">
              <RiImage2Fill size={28} aria-hidden="true" />
              <p>No graphics have been published for {teamName} yet.</p>
            </div>
          ) : (
            <div className="team-graphics-grid">
              {entries.map(([id, graphic]) => (
                <article className="team-graphic-card" key={id}>
                  <a href={graphic.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${graphic.name}`}>
                    {/* Supabase public asset URLs are dynamic and do not need Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={graphic.url} alt={graphic.name} loading="lazy" />
                  </a>
                  <div>
                    <strong>{graphic.name}</strong>
                    <a href={graphic.url} download target="_blank" rel="noopener noreferrer">
                      Download <RiDownloadFill size={16} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
