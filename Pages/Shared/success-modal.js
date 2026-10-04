// Shared/success-modal.js
if (!document.querySelector('link[href*="success-modal.css"]')) {
    const modalCss = document.createElement('link');
    modalCss.rel = 'stylesheet';
    modalCss.href = '/Shared/success-modal.css';
    document.head.appendChild(modalCss);
}

if (!document.getElementById('globalSuccessModal')) {
    const modalHTML = `
        <div class="success-modal-overlay" id="globalSuccessModal" style="display: none;">
            <div class="success-modal-card">
                <div class="success-icon-container">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h3 id="successModalTitle">Success!</h3>
                <p id="successModalMessage">Operation completed successfully.</p>
                <button type="button" class="success-modal-btn" id="successModalOkBtn">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.showSuccessModal = function(message, title = 'Success!', onClose = null) {
    const modalOverlay = document.getElementById('globalSuccessModal');
    const titleEl = document.getElementById('successModalTitle');
    const messageEl = document.getElementById('successModalMessage');
    const okBtn = document.getElementById('successModalOkBtn');

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