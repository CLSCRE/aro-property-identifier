/**
 * UI Utilities — Collapsible sections, density helpers
 * Commercial Lending Solutions — Phase 7 UI Overhaul
 */

const UIUtils = (() => {

  function initCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach((header, i) => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        header.classList.toggle('collapsed');
        if (content) {
          content.style.display = header.classList.contains('collapsed') ? 'none' : '';
        }
      });
      // All modules start collapsed except the first
      if (i > 0) {
        header.classList.add('collapsed');
        const content = header.nextElementSibling;
        if (content) content.style.display = 'none';
      }
    });
  }

  // Re-initialize after dynamic content renders (e.g., after report generation)
  function refreshCollapsibles(container) {
    if (!container) return;
    container.querySelectorAll('.section-header').forEach((header) => {
      if (header.dataset.bound) return;
      header.dataset.bound = 'true';
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        header.classList.toggle('collapsed');
        if (content) {
          content.style.display = header.classList.contains('collapsed') ? 'none' : '';
        }
      });
    });
  }

  return {
    initCollapsibleSections,
    refreshCollapsibles
  };
})();
