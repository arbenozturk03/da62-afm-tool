import { useEffect, useRef, type RefObject } from "react";

/**
 * Locks body scroll when a modal is open. Uses position:fixed + top:-scrollY for iOS Safari
 * and restores scroll position on close. Also prevents document-level touchmove (passive: false)
 * so the background doesn't scroll or rubber-band; touchmove inside modalContentRef is allowed.
 */
export function useLockBodyScroll(
  isOpen: boolean,
  options?: { modalContentRef?: RefObject<HTMLElement | null> }
) {
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    savedScrollY.current = window.scrollY ?? document.documentElement.scrollTop;
    const scrollY = savedScrollY.current;

    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const handleTouchMove: EventListener = (e) => {
      const ev = e as TouchEvent;
      const modalContent = options?.modalContentRef?.current;
      if (modalContent?.contains(ev.target as Node)) return;
      ev.preventDefault();
    };

    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener("touchmove", handleTouchMove, opts);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove, opts);
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);
}
