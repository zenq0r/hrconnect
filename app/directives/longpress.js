// Mobile/tablet equivalent of a desktop right-click. Rich records/cards bind
// their own context menu explicitly; every portal button also receives the
// same interaction through the delegated handlers installed after mount.
export const LONGPRESS_THRESHOLD_MS = 600;
export const LONGPRESS_MOVE_TOLERANCE_PX = 10;
export const longpressDirective = {
    mounted(el, binding) {
        el.__longpressHandler = binding.value;
        const state = { timer: null, startX: 0, startY: 0 };
        const clearTimer = () => { if (state.timer) { clearTimeout(state.timer); state.timer = null; } };
        const onTouchStart = (event) => {
            if (!event.touches || event.touches.length !== 1) { clearTimer(); return; }
            const touch = event.touches[0];
            state.startX = touch.clientX;
            state.startY = touch.clientY;
            clearTimer();
            state.timer = setTimeout(() => {
                state.timer = null;
                // A long-press fired — the browser will still synthesize a
                // `click` right after touchend. Swallow exactly that one click
                // so the card's own primary @click never also fires (no
                // accidental primary action, no double action).
                const suppressClick = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopImmediatePropagation(); };
                el.addEventListener('click', suppressClick, { capture: true, once: true });
                setTimeout(() => el.removeEventListener('click', suppressClick, { capture: true }), 500);
                if (el.__longpressHandler) el.__longpressHandler(touch);
            }, LONGPRESS_THRESHOLD_MS);
        };
        // Any real movement means the user is scrolling, not holding — cancel
        // the timer and let the scroll continue completely untouched (no
        // preventDefault anywhere in this directive, so normal scrolling is
        // never blocked).
        const onTouchMove = (event) => {
            if (!state.timer) return;
            const touch = event.touches && event.touches[0];
            if (!touch) return;
            if (Math.abs(touch.clientX - state.startX) > LONGPRESS_MOVE_TOLERANCE_PX || Math.abs(touch.clientY - state.startY) > LONGPRESS_MOVE_TOLERANCE_PX) clearTimer();
        };
        const onTouchEnd = () => clearTimer();
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchEnd, { passive: true });
        el.__longpressCleanup = () => {
            clearTimer();
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    },
    // The bound function is a fresh closure per v-for item (captures that row's
    // own `cust`/`project`) — Vue reuses the DOM node across re-renders, so the
    // handler reference must be refreshed here rather than only read once at mount.
    updated(el, binding) { el.__longpressHandler = binding.value; },
    unmounted(el) { if (el.__longpressCleanup) el.__longpressCleanup(); }
};