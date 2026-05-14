// ==UserScript==
// @name         Hide Inoreader Navigation Bars (New UI)
// @author       cdr-x
// @namespace    http://tampermonkey.net/
// @license      MIT
// @version      1.6
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
    };

    const init = () => {
        const header = document.getElementById('header_pane');
        const sideNav = document.getElementById('side-nav');

        if (!header && !sideNav) return false;

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
            const originalSidebarWidth =
                document.body.style.getPropertyValue('--sidebar-width') ||
                getComputedStyle(document.body).getPropertyValue('--sidebar-width') ||
                '200px';

            makePane(sideNav, {
                minimize: () => {
                    sideNav.style.width = COLLAPSED_SIZE;
                    sideNav.style.minWidth = COLLAPSED_SIZE;
                    sideNav.style.maxWidth = COLLAPSED_SIZE;
                    sideNav.style.overflow = 'hidden';
                    sideNav.style.filter = DIM_FILTER;
                    document.body.style.setProperty('--sidebar-width', COLLAPSED_SIZE);
                },
                expand: () => {
                    sideNav.style.width = '';
                    sideNav.style.minWidth = '';
                    sideNav.style.maxWidth = '';
                    sideNav.style.overflow = '';
                    sideNav.style.filter = '';
                    document.body.style.setProperty('--sidebar-width', originalSidebarWidth);
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
