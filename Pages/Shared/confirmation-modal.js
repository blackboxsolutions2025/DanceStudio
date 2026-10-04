// Shared/confirmation-modal.js
if (!document.querySelector('link[href*="confirm-modal.css"]')) {
    const modalCss = document.createElement('link');
    modalCss.rel = 'stylesheet';
    modalCss.href = '/Shared/confirmation-modal.css';
    document.head.appendChild(modalCss);
}

// Inject Modal HTML structure with initial inline hiding to prevent FOUC flashes
if (!document.getElementById('globalConfirmModal')) {
    const modalHTML = `
        <div class="confirm-modal-overlay" id="globalConfirmModal" style="display: none;">
            <div class="confirm-modal-card">
                <div class="confirm-icon-container">
                    <i class="fa-solid fa-circle-question"></i>
                </div>
                <h3 id="confirmModalTitle">Are you sure?</h3>
                <p id="confirmModalMessage">Do you want to proceed with this action?</p>
                <div class="confirm-modal-actions">
                    <button type="button" class="confirm-modal-btn confirm-modal-btn-cancel" id="confirmModalCancelBtn">Cancel</button>
                    <button type="button" class="confirm-modal-btn confirm-modal-btn-confirm" id="confirmModalConfirmBtn">Confirm</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Global function returning a Promise to handle confirmation flows cleanly via async/await
window.showConfirmModal = function(message, title = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const modalOverlay = document.getElementById('globalConfirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const messageEl = document.getElementById('confirmModalMessage');
        const confirmBtn = document.getElementById('confirmModalConfirmBtn');
        const cancelBtn = document.getElementById('confirmModalCancelBtn');

        if (!modalOverlay) {
            resolve(window.confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        
        modalOverlay.style.display = ''; // Make element visible for transition
        modalOverlay.classList.add('active');

        function cleanup(result) {
            modalOverlay.classList.remove('active');
            modalOverlay.style.display = 'none'; // Completely hide element after transition
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            modalOverlay.onclick = null;
            resolve(result);
        }

        const newConfirmBtn = document.getElementById('confirmModalConfirmBtn');
        const newCancelBtn = document.getElementById('confirmModalCancelBtn');

        newConfirmBtn.addEventListener('click', () => cleanup(true));
        newCancelBtn.addEventListener('click', () => cleanup(false));
        
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) cleanup(false);
        };
    });
};