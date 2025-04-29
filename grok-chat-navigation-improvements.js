// ==UserScript==
// @name         Grok Chat Navigation Improvements
// @namespace    http://tampermonkey.net/
// @license      MIT
// @version      1.2
// @description Keyboard navigation and message interaction for Grok chat
// @author       cdr-x
// @match        https://grok.com/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/533997/Grok%20Chat%20Navigation%20Improvements.user.js
// @updateURL https://update.greasyfork.org/scripts/533997/Grok%20Chat%20Navigation%20Improvements.meta.js
// ==/UserScript==

(function () {
    'use strict';

    let selectedIdx = -1;
    let isTogglingCodeEditor = false;

    // Inject CSS for selection styling and z-index handling with rainbow effect
    const style = document.createElement('style');
    style.textContent = `
        div.relative.group.flex.flex-col {
            transition: outline 0.2s ease, transform 0.2s ease;
            transform: scale(1);
            z-index: 1;
        }
        .grok-vim-selected {
            outline: 2px solid;
            animation: rainbowHighlight 2s linear infinite;
            z-index: 10 !important;
            transform: scale(1.01);
            position: relative;
        }
        @keyframes rainbowHighlight {
            0% { outline-color: #569cd6; }
            12.5% { outline-color: #da70d6; }
            25% { outline-color: #d4d4d4; }
            37.5% { outline-color: #ce9178; }
            50% { outline-color: #179fff; }
            62.5% { outline-color: #3dc9b0; }
            75% { outline-color: #ffd700; }
            87.5% { outline-color: #608b4e; }
            100% { outline-color: #1e90ff; }
        }
    `;
    document.head.appendChild(style);

    // ### Helper Functions

    // Get the scrollable container
    function getScrollContainer() {
        const candidates = Array.from(document.querySelectorAll("div.overflow-y-auto"));
        if (!candidates.length) return null;
        let container = candidates.find(div =>
            div.className.includes("flex-col") && div.className.includes("items-center") && div.className.includes("px-5")
        );
        return container || candidates[0];
    }

    // Get the input area at the bottom
    function getInputArea() {
        return document.querySelector("div.absolute.bottom-0");
    }

    // Retrieve all message boxes with more specific selector
    function getMessageBoxes() {
        const container = getScrollContainer();
        if (!container) return [];
        return Array.from(container.querySelectorAll("div.relative.group.flex.flex-col")).filter(box =>
            box.querySelector(".message-bubble")
        );
    }

    // Highlight the selected message with improved scrolling logic
    function highlightSelected({ scrollIntoView = false } = {}) {
        const boxes = getMessageBoxes();
        const container = getScrollContainer();

        boxes.forEach(box => {
            box.classList.remove('grok-vim-selected');
            box.style.zIndex = '1';
            box.style.outline = '';
        });

        if (selectedIdx >= 0 && selectedIdx < boxes.length) {
            const box = boxes[selectedIdx];
            box.classList.add('grok-vim-selected');
            box.style.zIndex = '10';
            if (scrollIntoView && container) {
                const boxRect = box.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                if (boxRect.top < containerRect.top || boxRect.bottom > containerRect.bottom) {
                    box.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            }
        }
    }

    // Scroll selected message bottom to 15% above the effective visible area
    function scrollSelectedToBottom15() {
        const container = getScrollContainer();
        const boxes = getMessageBoxes();
        if (!container || selectedIdx < 0 || selectedIdx >= boxes.length) return;
        const box = boxes[selectedIdx];
        const inputBar = getInputArea();
        let offset = 20; // default padding
        if (inputBar) {
            offset = inputBar.getBoundingClientRect().height + 20;
        }
        const boxBottom = box.offsetTop + box.offsetHeight;
        const desiredScrollTop = boxBottom - (container.clientHeight - offset);
        const maxScroll = container.scrollHeight - container.clientHeight;
        const scrollTop = Math.max(0, Math.min(desiredScrollTop, maxScroll));
        container.scrollTo({ top: scrollTop, behavior: "smooth" });
    }

    // Check if currently editing the selected message
    function isEditingMessage() {
        const ae = document.activeElement;
        if (!ae || ae.tagName.toLowerCase() !== "textarea") return false;
        const box = ae.closest("div.relative.group.flex.flex-col");
        if (!box) return false;
        const boxes = getMessageBoxes();
        const idx = boxes.indexOf(box);
        return (idx >= 0 && idx === selectedIdx);
    }

    // Check if in text input mode (bottom input area)
    function isInTextInputMode() {
        const ae = document.activeElement;
        return ae && ae.tagName.toLowerCase() === "textarea" && !isEditingMessage();
    }

    // Get the first and last visible message indices based on scroll position
    function getVisibleMessageIndices() {
        const container = getScrollContainer();
        if (!container) return { first: -1, last: -1 };
        const boxes = getMessageBoxes();
        const viewportTop = container.scrollTop;
        const viewportBottom = viewportTop + container.clientHeight;
        let first = -1;
        let last = -1;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const boxTop = box.offsetTop;
            const boxBottom = boxTop + box.offsetHeight;
            if (boxBottom > viewportTop && boxTop < viewportBottom) {
                if (first === -1) first = i;
                last = i;
            } else if (boxTop >= viewportBottom) {
                break;
            }
        }
        return { first, last };
    }

    // ### Keyboard Event Listener
    let lastEndKeyTime = 0;
    let lastHomeKeyTime = 0;
    document.addEventListener('keydown', (event) => {
        const boxes = getMessageBoxes();
        if (!boxes.length) return;

        // Ctrl+I focuses the main chat input box
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
            const inputBox = document.querySelector('div.absolute.bottom-0 textarea');
            if (inputBox) {
                inputBox.focus();
                event.preventDefault();
                return;
            }
        }

        const editing = isEditingMessage();

        if (editing) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'End') {
                const textarea = document.activeElement;
                if (textarea.tagName.toLowerCase() === "textarea") {
                    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                    scrollSelectedToBottom15();
                    event.preventDefault();
                }
            } else if ((event.ctrlKey || event.metaKey) && event.key === 'Home') {
                const textarea = document.activeElement;
                if (textarea.tagName.toLowerCase() === "textarea") {
                    textarea.selectionStart = textarea.selectionEnd = 0;
                    boxes[selectedIdx].scrollIntoView({ block: 'start', behavior: 'smooth' });
                    event.preventDefault();
                }
            } else if (event.key === 'Escape') {
                // Robustly find the cancel button after the textarea
                const textarea = document.activeElement;
                if (textarea && textarea.tagName.toLowerCase() === 'textarea') {
                    // Find the closest message box
                    const messageBox = textarea.closest('div.relative.group.flex.flex-col');
                    // Find the button group after the textarea
                    let cancelButton = null;
                    if (messageBox) {
                        // Find the parent of textarea, then the next sibling div with buttons
                        let parent = textarea.parentElement;
                        while (parent && parent !== messageBox && !cancelButton) {
                            let sibling = parent.nextElementSibling;
                            while (sibling && !cancelButton) {
                                // Look for a div with flex-row and buttons
                                if (sibling.matches && sibling.matches('div.flex.flex-row')) {
                                    const btns = Array.from(sibling.querySelectorAll('button'));
                                    if (btns.length > 0) {
                                        cancelButton = btns[0]; // First button is always cancel
                                        break;
                                    }
                                }
                                sibling = sibling.nextElementSibling;
                            }
                            parent = parent.parentElement;
                        }
                    }
                    if (!cancelButton && messageBox) {
                        // Fallback: look for any visible button with 2+ buttons after textarea
                        const btns = Array.from(messageBox.querySelectorAll('textarea ~ div button'));
                        if (btns.length > 0) cancelButton = btns[0];
                    }
                    if (cancelButton) {
                        cancelButton.click();
                        event.preventDefault();
                        setTimeout(() => {
                            highlightSelected({ scrollIntoView: false });
                        }, 100);
                    }
                }
            }
            return;
        } else {
            if (event.key === 'Escape') {
                const ae = document.activeElement;
                // If in chat input box (bottom input area), defocus and select previously selected message
                if (ae && ae.tagName.toLowerCase() === 'textarea' && isInTextInputMode()) {
                    ae.blur();
                    if (window._grokPrevSelectedIdx !== undefined && window._grokPrevSelectedIdx >= 0 && window._grokPrevSelectedIdx < boxes.length) {
                        selectedIdx = window._grokPrevSelectedIdx;
                        highlightSelected({ scrollIntoView: true });
                    }
                    event.preventDefault();
                    return;
                }
                const aside = document.querySelector('aside');
                if (aside && aside.offsetParent !== null) {
                    const closeButton = aside.querySelector('div.flex.justify-end > button');
                    if (closeButton) {
                        closeButton.click();
                        event.preventDefault();
                    }
                } else if (selectedIdx >= 0) {
                    const selectedBox = boxes[selectedIdx];
                    let toggleElem = selectedBox.querySelector('.pl-3.pr-5.py-3.flex.gap-2');
                    if (!toggleElem) {
                        toggleElem = selectedBox.querySelector('div.message-bubble > div.py-1 > button');
                    }
                    if (toggleElem) {
                        toggleElem.click();
                        event.preventDefault();
                    } else {
                        selectedIdx = -1;
                        highlightSelected();
                        const container = getScrollContainer();
                        if (container) container.focus();
                        event.preventDefault();
                    }
                }
            } else if (!isInTextInputMode()) {
                if (event.key === 'Home') {
                    const now = Date.now();
                    if (selectedIdx === -1) {
                        selectedIdx = 0;
                        highlightSelected({ scrollIntoView: true });
                    } else {
                        // Double-tap Home: if within 2s, go to first message
                        if (now - lastHomeKeyTime < 2000) {
                            selectedIdx = 0;
                            highlightSelected({ scrollIntoView: true });
                            boxes[0].scrollIntoView({ block: 'start', behavior: 'smooth' });
                        } else {
                            boxes[selectedIdx].scrollIntoView({ block: 'start', behavior: 'smooth' });
                        }
                        lastHomeKeyTime = now;
                    }
                    event.preventDefault();
                } else if (event.key === 'End') {
                    const now = Date.now();
                    if (selectedIdx === -1) {
                        selectedIdx = boxes.length - 1;
                        highlightSelected();
                        scrollSelectedToBottom15();
                    } else {
                        // Double-tap End: if within 2s, go to last message
                        if (now - lastEndKeyTime < 2000) {
                            selectedIdx = boxes.length - 1;
                            highlightSelected({ scrollIntoView: true });
                            scrollSelectedToBottom15();
                        } else {
                            scrollSelectedToBottom15();
                        }
                        lastEndKeyTime = now;
                    }
                    event.preventDefault();
                } else if (event.key === 'j' || event.key === 'ArrowDown') {
                    if (selectedIdx === -1) {
                        const { first } = getVisibleMessageIndices();
                        selectedIdx = first !== -1 ? first : 0;
                    } else {
                        selectedIdx = Math.min(selectedIdx + 1, boxes.length - 1);
                    }
                    highlightSelected({ scrollIntoView: true });
                    event.preventDefault();
                } else if (event.key === 'k' || event.key === 'ArrowUp') {
                    if (selectedIdx === -1) {
                        const { last } = getVisibleMessageIndices();
                        selectedIdx = last !== -1 ? last : boxes.length - 1;
                    } else {
                        selectedIdx = Math.max(selectedIdx - 1, 0);
                    }
                    highlightSelected({ scrollIntoView: true });
                    event.preventDefault();
                } else if (selectedIdx >= 0) {
                    const box = boxes[selectedIdx];
                    // Robustly find the edit/copy/regenerate buttons regardless of language
                    const visibleButtons = Array.from(box.querySelectorAll('button')).filter(btn => btn.offsetParent !== null);
                    if (event.key === 'e' && !event.ctrlKey) {
                        // Select the first visible button (Edit)
                        if (visibleButtons.length > 0) {
                            visibleButtons[0].click();
                            event.preventDefault();
                        }
                    } else if (event.key === 'c' && !event.ctrlKey) {
                        // Try to find the copy button by aria-label or icon
                        let copyBtn = visibleButtons.find(btn => {
                            const label = btn.getAttribute('aria-label') || '';
                            return /copy|コピー|копировать|copier|kopieren|copia/i.test(label);
                        });
                        if (!copyBtn) {
                            // Fallback: if regenerate button exists, try next button
                            let regenIdx = visibleButtons.findIndex(btn => {
                                const label = btn.getAttribute('aria-label') || '';
                                return /regenerate|再生成|再生成|regenerar|erneuern|regenerieren/i.test(label);
                            });
                            if (regenIdx !== -1 && visibleButtons[regenIdx + 1]) {
                                copyBtn = visibleButtons[regenIdx + 1];
                            }
                        }
                        if (copyBtn) {
                            copyBtn.click();
                            event.preventDefault();
                        }
                    } else if (event.key === 'r' && !event.ctrlKey) {
                        // Try to find the regenerate button by aria-label or icon
                        let regenBtn = visibleButtons.find(btn => {
                            const label = btn.getAttribute('aria-label') || '';
                            return /regenerate|再生成|再生成|regenerar|erneuern|regenerieren/i.test(label);
                        });
                        if (!regenBtn) {
                            // Fallback: look for a button with a refresh/rotate icon
                            regenBtn = visibleButtons.find(btn => {
                                const svg = btn.querySelector('svg');
                                if (!svg) return false;
                                return /rotate|refresh|regenerate|arrow/i.test(svg.outerHTML);
                            });
                        }
                        if (regenBtn) {
                            regenBtn.click();
                            event.preventDefault();
                        }
                    }
                }
            }
        }
        // Track previous selectedIdx for chat input Escape
        if (!isInTextInputMode()) {
            window._grokPrevSelectedIdx = selectedIdx;
        }
    });

    // ### Mouse Click Event Listener
    document.addEventListener('click', (event) => {
        if (event.target.closest('aside')) return;
        const boxes = getMessageBoxes();
        let found = false;
        boxes.forEach((box, i) => {
            if (box.contains(event.target)) {
                selectedIdx = i;
                highlightSelected({ scrollIntoView: false });
                found = true;
            }
        });
        if (!found) {
            selectedIdx = -1;
            highlightSelected();
        }
    }, true);

    // ### Scroll Event Listener
    function handleScroll() {
        if (isEditingMessage() || isTogglingCodeEditor) return;
        const boxes = getMessageBoxes();
        if (!boxes.length) return;
        const container = getScrollContainer();
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;
        if (selectedIdx >= 0 && selectedIdx < boxes.length) {
            const box = boxes[selectedIdx];
            const boxTop = box.offsetTop;
            const boxHeight = box.offsetHeight;
            if (boxTop + boxHeight <= scrollTop || boxTop >= scrollTop + viewportHeight) {
                selectedIdx = -1;
                highlightSelected();
            }
        }
    }

    function installScrollListener() {
        const container = getScrollContainer();
        if (container) {
            let scheduled = null;
            container.addEventListener('scroll', () => {
                if (scheduled) cancelAnimationFrame(scheduled);
                scheduled = requestAnimationFrame(handleScroll);
            });
        }
    }

    // ### Initialization
    setTimeout(() => {
        installScrollListener();
        handleScroll();
    }, 250);

    // ### DOM Mutation Observer
    const observer = new MutationObserver(() => {
        highlightSelected({ scrollIntoView: false });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ### Debugging Handle
    window.grokVimNav = { getScrollContainer, getMessageBoxes, highlightSelected, handleScroll };
})();
