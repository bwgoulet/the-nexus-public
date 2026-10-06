'use client';

import { useState } from 'react';

export interface StatCard {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}

interface StatsSummaryGridProps {
  cards: StatCard[];
  playerTag: string;
}

export default function StatsSummaryGrid({ cards, playerTag }: StatsSummaryGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleCardClick = (index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="stats-profile-grid" aria-label={`${playerTag} stats summary`}>
      {cards.map((card, index) => {
        const isSelected = selectedIndex === index;
        const classes = [
          'stats-summary-card',
          'is-interactive',
          card.highlight ? 'is-highlighted' : '',
          isSelected ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            type="button"
            className={classes}
            key={card.label}
            onClick={() => handleCardClick(index)}
            aria-pressed={isSelected}
            aria-label={`${card.label}: ${card.value}`}
          >
            <span className="stats-summary-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="stats-summary-label">{card.label}</span>
            <strong className="stats-summary-value">{card.value}</strong>
            {card.detail ? <span className="stats-summary-detail">{card.detail}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
