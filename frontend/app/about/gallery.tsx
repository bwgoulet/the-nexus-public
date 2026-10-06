'use client';

import { useState, useEffect, useRef } from 'react';

export default function AboutHeroGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  const selectSlide = (index: number) => {
    setActiveIndex(index);
    setIsPlaying(false);

    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = setTimeout(() => {
      setIsPlaying(true);
    }, 15000);
  };

  return (
    <div className="about-hero-gallery-container">
      <div className="about-hero-gallery" aria-hidden="true">
        <div
          className={`about-gallery-slice about-slice-1 ${activeIndex === 0 ? 'is-active' : ''}`}
          onClick={() => selectSlide(0)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              selectSlide(0);
            }
          }}
          aria-label="View collegiate match on Pokemon Stadium 2"
        >
          <img src="/image/about_hero_1.jpg" alt="Collegiate match on Pokemon Stadium 2" />
        </div>
        <div
          className={`about-gallery-slice about-slice-2 ${activeIndex === 1 ? 'is-active' : ''}`}
          onClick={() => selectSlide(1)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              selectSlide(1);
            }
          }}
          aria-label="View weekly highlight broadcast stream screen"
        >
          <img src="/image/about_hero_2.jpg" alt="Weekly highlight broadcast stream screen" />
        </div>
        <div
          className={`about-gallery-slice about-slice-3 ${activeIndex === 2 ? 'is-active' : ''}`}
          onClick={() => selectSlide(2)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              selectSlide(2);
            }
          }}
          aria-label="View battlefield stage crew battle"
        >
          <img src="/image/about_hero_3.jpg" alt="Battlefield stage crew battle" />
        </div>
        <div className="about-gallery-border-top" />
        <div className="about-gallery-border-bottom" />
        <div className="about-gallery-border-left" />
        <div className="about-gallery-border-right" />
      </div>

      <div className="about-gallery-controls">
        <div className="about-gallery-dots">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              onClick={() => selectSlide(idx)}
              className={`about-gallery-dot ${activeIndex === idx ? 'is-active' : ''}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

