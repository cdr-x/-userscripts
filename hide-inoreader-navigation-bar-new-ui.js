// ==UserScript==
// @name         Hide Inoreader Navigation Bars (New UI)
// @author       cdr-x
// @namespace    http://tampermonkey.net/
// @license      MIT
// @version      2.4
// @description  Shrinks and blacks out Inoreader's top header pane and side navigation pane to reduce OLED burn-in. Hover a pane to restore it; the pane shrinks and goes dark after a short delay when the mouse leaves. Uses filter:brightness(0) instead of opacity so content behind the panels never bleeds through. Article-view sticky buttons are pinned to top:0 so they fill the space freed by the collapsed header.
// @match        *://*.inoreader.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DIM_FILTER = 'brightness(0)';
    const COLLAPSED_SIZE = '6px';
    const RESTORE_DELAY_MS = 600;
    const TRANSITION = 'filter 0.3s ease, height 0.3s ease, width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease';
    const CONTENT_Z = '10001';
    const SIDE_NAV_Z = '10002';

    const captureOriginalSidebarWidth = () => {
        const inline = document.body.style.getPropertyValue('--sidebar-width');
        if (inline) return inline.trim();
        const computed = getComputedStyle(document.body).getPropertyValue('--sidebar-width');
        return (computed && computed.trim()) || '200px';
    };

    const injectLayout = () => {
        if (document.getElementById('oled-layout-override')) return;
        const originalSidebarWidth = captureOriginalSidebarWidth();
        const style = document.createElement('style');
        style.id = 'oled-layout-override';
        style.textContent = `
            body {
                --sidebar-width: 0px !important;
            }
            #side-nav {
                --sidebar-width: ${originalSidebarWidth} !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                height: 100vh !important;
                z-index: ${SIDE_NAV_Z} !important;
                will-change: transform;
            }
            #sidebar_resizer {
                display: none !important;
            }
            body,
            body.tree_pane_docked {
                padding-left: 0 !important;
                margin-left: 0 !important;
            }
            #sitecontent,
            body.tree_pane_docked #sitecontent {
                position: relative !important;
                left: 0 !important;
                padding-left: 0 !important;
                margin-left: 0 !important;
                width: 100% !important;
                z-index: ${CONTENT_Z} !important;
            }
            #sitecontent > .d-flex,
            body.tree_pane_docked #sitecontent > .d-flex {
                position: relative !important;
                left: 0 !important;
                padding-left: 0 !important;
                margin-left: 0 !important;
                width: 100% !important;
                z-index: ${CONTENT_Z} !important;
                display: flex !important;
                justify-content: flex-start !important;
                align-items: stretch !important;
            }
            #content-wrapper {
                position: relative !important;
                left: 0 !important;
                right: auto !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                width: 100% !important;
                max-width: none !important;
                min-width: 0 !important;
                flex: 1 1 100% !important;
                flex-basis: 100% !important;
                align-self: stretch !important;
                z-index: ${CONTENT_Z} !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const STICKY_TARGET_SELECTOR = '.article_footer_main_buttons, .article_footer_placeholder_middle';
    const PINNED_ATTR = 'data-oled-pinned';

    const pinStickyAncestors = (root = document) => {
        const targets = root.querySelectorAll(STICKY_TARGET_SELECTOR);
        targets.forEach(target => {
            let el = target;
            let depth = 0;
            while (el && el !== document.body && depth < 12) {
                if (!el.hasAttribute(PINNED_ATTR)) {
                    const pos = getComputedStyle(el).position;
                    if (pos === 'sticky' || pos === 'fixed') {
                        el.style.setProperty('top', '0', 'important');
                        el.setAttribute(PINNED_ATTR, '');
                    }
                }
                el = el.parentElement;
                depth++;
            }
            // Also force-pin the target itself in case it's the sticky one but
            // computed-style detection missed it (e.g., position rule set later).
            target.style.setProperty('top', '0', 'important');
        });
    };

    const watchForStickyButtons = () => {
        pinStickyAncestors();
        const obs = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches?.(STICKY_TARGET_SELECTOR) || node.querySelector?.(STICKY_TARGET_SELECTOR)) {
                        pinStickyAncestors(node.parentNode || document);
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    };

    // Walk the live ancestor chain from #content-wrapper up to #wraper and
    // neutralize every horizontal-offset vector with inline !important (which
    // beats stylesheet !important). This avoids CSS-selector/specificity
    // guesswork entirely.
    const forceLeftAlign = () => {
        const cw = document.getElementById('content-wrapper');
        if (!cw) return;

        // Build the full chain: content-wrapper -> ... -> #wraper -> body -> html.
        // body/html were previously excluded, so flex/grid centering on body
        // (which offsets #wraper from the viewport's left edge) was never killed.
        const chain = [];
        let el = cw;
        let depth = 0;
        while (el && depth < 12) {
            chain.push(el);
            if (el === document.documentElement) break;
            el = el.parentElement;
            depth++;
        }

        for (const node of chain) {
            node.style.setProperty('margin-left', '0', 'important');
            node.style.setProperty('margin-right', '0', 'important');
            node.style.setProperty('padding-left', '0', 'important');
            node.style.setProperty('left', '0', 'important');
            node.style.setProperty('right', 'auto', 'important');
            node.style.setProperty('transform', 'none', 'important');
            node.style.setProperty('float', 'none', 'important');
            node.style.setProperty('inset-inline-start', '0', 'important');

            const cs = getComputedStyle(node);
            if (cs.display.includes('flex')) {
                node.style.setProperty('justify-content', 'flex-start', 'important');
                node.style.setProperty('align-items', 'stretch', 'important');
            }
            if (cs.display.includes('grid')) {
                node.style.setProperty('justify-items', 'start', 'important');
                node.style.setProperty('justify-content', 'start', 'important');
            }
        }

        // #content-wrapper is a flex item of the .d-flex wrapper: its main size
        // comes from flex-basis, NOT width, so override the basis too.
        cw.style.setProperty('width', '100%', 'important');
        cw.style.setProperty('max-width', 'none', 'important');
        cw.style.setProperty('min-width', '0', 'important');
        cw.style.setProperty('flex', '1 1 100%', 'important');
        cw.style.setProperty('flex-basis', '100%', 'important');
        cw.style.setProperty('align-self', 'stretch', 'important');

        // #wraper must fill the full body width (it may have its own max-width).
        const wraper = document.getElementById('wraper');
        if (wraper) {
            wraper.style.setProperty('width', '100%', 'important');
            wraper.style.setProperty('max-width', 'none', 'important');
        }
    };

    const watchLeftAlign = () => {
        forceLeftAlign();
        let queued = false;
        const obs = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                forceLeftAlign();
            });
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        window.addEventListener('resize', forceLeftAlign, { passive: true });
    };

    const makePane = (el, { minimize, expand }) => {
        el.style.transition = TRANSITION;
        let hideTimer = null;

        const doExpand = () => {
            clearTimeout(hideTimer);
            expand();
        };

        const scheduleMinimize = () => {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(minimize, RESTORE_DELAY_MS);
        };

        el.addEventListener('mouseenter', doExpand);
        el.addEventListener('mouseleave', scheduleMinimize);

        minimize();
        return { doExpand, scheduleMinimize };
    };

    const init = () => {
        const header = document.getElementById('header_pane');
        const sideNav = document.getElementById('side-nav');

        if (!header && !sideNav) return false;

        injectLayout();
        watchLeftAlign();
        watchForStickyButtons();

        if (header) {
            makePane(header, {
                minimize: () => {
                    header.style.height = COLLAPSED_SIZE;
                    header.style.minHeight = COLLAPSED_SIZE;
                    header.style.overflow = 'hidden';
                    header.style.filter = DIM_FILTER;
                },
                expand: () => {
                    header.style.height = '';
                    header.style.minHeight = '';
                    header.style.overflow = '';
                    header.style.filter = '';
                }
            });
        }

        if (sideNav) {
            const clampWidth = (el) => {
                if (!el) return;
                el.style.setProperty('width', COLLAPSED_SIZE, 'important');
                el.style.setProperty('min-width', COLLAPSED_SIZE, 'important');
                el.style.setProperty('max-width', COLLAPSED_SIZE, 'important');
                el.style.setProperty('overflow', 'hidden', 'important');
            };
            const unclampWidth = (el) => {
                if (!el) return;
                el.style.removeProperty('width');
                el.style.removeProperty('min-width');
                el.style.removeProperty('max-width');
                el.style.removeProperty('overflow');
            };
            // #tabs_pane / #tree_pane are independently positioned inside
            // #side-nav, so they escape the parent width clamp — clamp them
            // directly. Re-queried each call to survive SPA re-renders.
            const sideNavParts = () => [
                sideNav,
                document.getElementById('tabs_pane'),
                document.getElementById('tree_pane')
            ];

            makePane(sideNav, {
                minimize: () => {
                    sideNavParts().forEach(clampWidth);
                    sideNav.style.filter = DIM_FILTER;
                },
                expand: () => {
                    sideNavParts().forEach(unclampWidth);
                    sideNav.style.filter = '';
                }
            });
        }

        return true;
    };

    if (init()) return;

    const observer = new MutationObserver(() => {
        if (init()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
