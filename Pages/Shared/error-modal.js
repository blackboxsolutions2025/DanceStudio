// Shared/error-modal.js
if (!document.querySelector('link[href*="error-modal.css"]')) {
    const modalCss = document.createElement('link');
    modalCss.rel = 'stylesheet';
    modalCss.href = '/Shared/error-modal.css';
    document.head.appendChild(modalCss);
}

if (!document.getElementById('globalErrorModal')) {
    const modalHTML = `
        <div class="error-modal-overlay" id="globalErrorModal" style="display: none;">
            <div class="error-modal-card">
                <div class="error-icon-container">
                    <i class="fa-solid fa-circle-xmark"></i>
                </div>
                <h3 id="errorModalTitle">Error</h3>
                <p id="errorModalMessage">An error occurred.</p>
                <button type="button" class="error-modal-btn" id="errorModalOkBtn">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.showErrorModal = function(message, title = 'Error', onClose = null) {
    const modalOverlay = document.getElementById('globalErrorModal');
    const titleEl = document.getElementById('errorModalTitle');
    const messageEl = document.getElementById('errorModalMessage');
    const okBtn = document.getElementById('errorModalOkBtn');

    if (!modalOverlay) {
        alert(message); 
        if (onClose) onClose();
        return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    modalOverlay.style.display = ''; // Show element
    modalOverlay.classList.add('active');

    function handleClose() {
        modalOverlay.classList.remove('active');
        modalOverlay.style.display = 'none'; // Hide element completely
        okBtn.removeEventListener('click', handleClose);
        if (onClose) onClose();
    }

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener('click', handleClose);
    
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) handleClose();
    };
};