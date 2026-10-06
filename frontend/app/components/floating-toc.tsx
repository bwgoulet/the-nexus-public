'use client';

import { useEffect, useState, useRef, useMemo } from 'react';

interface TOCItem {
  id: string;
  label: string;
  number?: string;
  children?: readonly { id: string; label: string; number?: string }[] | { id: string; label: string; number?: string }[];
}

interface FloatingTOCProps {
  items: readonly TOCItem[] | TOCItem[];
}

export default function FloatingTOC({ items }: FloatingTOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const intersectingIdsRef = useRef<Set<string>>(new Set());
  const isScrollingFromClick = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten the TOC item IDs to maintain the natural reading order
  const flatItemIds = useMemo(() => {
    const ids: string[] = [];
    items.forEach((item) => {
      ids.push(item.id);
      if (item.children) {
        item.children.forEach((child) => {
          ids.push(child.id);
        });
      }
    });
    return ids;
  }, [items]);

  // Set of child subheading IDs to prioritize them over parent container wrappers
  const childIds = useMemo(() => {
    const children = new Set<string>();
    items.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => {
          children.add(child.id);
        });
      }
    });
    return children;
  }, [items]);

  useEffect(() => {
    const heroEl = document.querySelector('.rulebook-hero, .about-hero, .dashboard-hero, .matches-hero');
    if (!heroEl) {
      const fallbackVisibility = window.setTimeout(() => setIsVisible(true), 0);
      return () => window.clearTimeout(fallbackVisibility);
    }

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '0px',
      }
    );

    heroObserver.observe(heroEl);

    return () => {
      heroObserver.unobserve(heroEl);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingFromClick.current) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            intersectingIdsRef.current.add(entry.target.id);
          } else {
            intersectingIdsRef.current.delete(entry.target.id);
          }
        });

        if (intersectingIdsRef.current.size > 0) {
          // If any child subheadings are intersecting, prioritize them over parent sections
          const intersectingChildren = Array.from(intersectingIdsRef.current).filter((id) =>
            childIds.has(id)
          );

          const candidates =
            intersectingChildren.length > 0
              ? intersectingChildren
              : Array.from(intersectingIdsRef.current);

          // Select the candidate that is highest/earliest in the reading order
          const bestId = flatItemIds.find((id) => candidates.includes(id));
          if (bestId) {
            setActiveId(bestId);
          }
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    flatItemIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [childIds, flatItemIds]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      // Temporarily disable the observer from overriding active state
      isScrollingFromClick.current = true;
      setActiveId(id);

      // Reset intersecting set to focus on the clicked item
      intersectingIdsRef.current.clear();
      intersectingIdsRef.current.add(id);

      const headerOffset = 90; // offset to clear sticky top navigation
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Update URL hash without jumping the page
      window.history.pushState(null, '', `#${id}`);

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingFromClick.current = false;
      }, 800); // Allow smooth scrolling animation to complete
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  return (
    <nav className={`floating-toc ${isVisible ? 'is-visible' : ''}`} aria-label="Table of contents navigation">
      <div className="floating-toc-kicker">On this page</div>
      <div className="floating-toc-container">
        <div className="floating-toc-line" aria-hidden="true" />
        <ul className="floating-toc-list">
          {items.map((item) => {
            const isSelfActive = activeId === item.id;
            const isChildActive = item.children?.some((child) => child.id === activeId) ?? false;
            const isParentActive = isSelfActive || isChildActive;

            return (
              <li key={item.id} className={`floating-toc-item ${isParentActive ? 'is-parent-active' : ''} ${isSelfActive ? 'is-active' : ''}`}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className="floating-toc-link"
                >
                  {item.number && <span className="floating-toc-number">{item.number}</span>}
                  <span className="floating-toc-label">{item.label}</span>
                </a>

                {item.children && item.children.length > 0 && (
                  <ul className="floating-toc-sublist">
                    {item.children.map((child) => {
                      const isSubActive = activeId === child.id;
                      return (
                        <li key={child.id} className={`floating-toc-subitem ${isSubActive ? 'is-active' : ''}`}>
                          <a
                            href={`#${child.id}`}
                            onClick={(e) => handleClick(e, child.id)}
                            className="floating-toc-sublink"
                          >
                            {child.number && <span className="floating-toc-subnumber">{child.number}</span>}
                            <span className="floating-toc-sublabel">{child.label}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
