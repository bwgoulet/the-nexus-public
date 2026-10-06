'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TournamentSeason } from '@/lib/data';

type StandingsSeasonFilterProps = {
  seasons: TournamentSeason[];
  selectedSeasonId: string;
};

export function StandingsSeasonFilter({ seasons, selectedSeasonId }: StandingsSeasonFilterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    seasons.forEach((season) => {
      if (season.id !== selectedSeasonId) {
        router.prefetch(`/standings?season=${encodeURIComponent(season.id)}`);
      }
    });
  }, [isOpen, router, seasons, selectedSeasonId]);

  const selectSeason = (seasonId: string) => {
    setIsOpen(false);
    startTransition(() => {
      router.push(`/standings?season=${encodeURIComponent(seasonId)}`);
    });
  };

  return (
    <div className={`standings-season-filter${isPending ? ' is-pending' : ''}`} ref={dropdownRef}>
      <span>
        <small>Viewing standings for</small>
        <strong>{isPending ? 'Loading…' : selectedSeason?.name}</strong>
      </span>
      <button
        type="button"
        aria-label="Choose tournament or season"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="standings-season-filter-toggle"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={isOpen ? 'is-open' : ''}
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div role="listbox" aria-label="Tournament or season" className="standings-season-filter-menu">
          {seasons.map((season) => {
            const isSelected = season.id === selectedSeasonId;

            return (
              <button
                key={season.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectSeason(season.id)}
                disabled={isPending}
                className={isSelected ? 'is-selected' : ''}
              >
                <span>{season.name}</span>
                {isSelected ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
