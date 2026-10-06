'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiFilter3Fill, RiArrowDownSLine, RiCheckFill } from '@remixicon/react';
import type { TournamentSeason } from '@/lib/data';

type Props = {
  seasons: TournamentSeason[];
  selectedSeasonId: string | null;
  basePath?: string;
  compact?: boolean;
};

export default function StatsSeasonFilter({ seasons, selectedSeasonId, basePath = '/stats', compact = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const selectedLabel = selectedSeason ? selectedSeason.name : 'ALL TOURNAMENTS & SEASONS';

  const updateSeason = (seasonId: string) => {
    setIsOpen(false);
    startTransition(() => {
      router.push(seasonId ? `${basePath}?season=${encodeURIComponent(seasonId)}` : basePath);
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div
      ref={filterRef}
      className={`stats-season-filter${compact ? ' is-compact' : ''}${isPending ? ' is-pending' : ''}${isOpen ? ' is-open' : ''}`}
    >
      <span className="stats-season-filter-icon" aria-hidden="true">
        <RiFilter3Fill size={20} />
      </span>
      <div className="stats-season-content">
        {!compact ? <small className="stats-season-kicker">Tournament / season</small> : null}
        <div className="stats-season-dropdown-container">
          <button
            type="button"
            className="stats-season-trigger"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            disabled={isPending}
          >
            <span>{selectedLabel}</span>
            <RiArrowDownSLine size={18} className={`stats-season-select-arrow ${isOpen ? 'is-open' : ''}`} />
          </button>

          {isOpen ? (
            <div className="stats-season-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className={`stats-season-menu-item ${!selectedSeasonId ? 'is-active' : ''}`}
                onClick={() => updateSeason('')}
              >
                <span>ALL TOURNAMENTS &amp; SEASONS</span>
                {!selectedSeasonId ? <RiCheckFill size={16} className="stats-season-check" /> : null}
              </button>
              {seasons.map((season) => {
                const isActive = season.id === selectedSeasonId;
                return (
                  <button
                    key={season.id}
                    type="button"
                    role="menuitem"
                    className={`stats-season-menu-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => updateSeason(season.id)}
                  >
                    <span>{season.name.toUpperCase()}</span>
                    {isActive ? <RiCheckFill size={16} className="stats-season-check" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {isPending ? <span className="stats-season-loading" aria-live="polite">Updating…</span> : null}
    </div>
  );
}
