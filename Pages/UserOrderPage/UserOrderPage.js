document.addEventListener('DOMContentLoaded', () => {
    fetchOrders();

    // Setup QR Modal Listeners
    document.getElementById('closeQrBtn').addEventListener('click', closeQrModal);
    document.getElementById('qrModal').addEventListener('click', (e) => {
        if (e.target.id === 'qrModal') closeQrModal();
    });
});

async function fetchOrders() {
    const ordersContainer = document.getElementById('ordersList');
    
    try {
        const response = await window.secureFetch('/api/user/orders');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../LoginPage/LoginPage.html';
                return;
            }
            throw new Error('Failed to fetch orders.');
        }

        const orders = await response.json();
        
        if (orders.length === 0) {
            ordersContainer.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 40px;">
                    <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 15px; color: #1e293b;"></i>
                    <p>You have no confirmed or claimed orders yet.</p>
                </div>
            `;
            return;
        }

        ordersContainer.innerHTML = ''; 

        orders.forEach(order => {
            const isClaimed = order.status === 'claimed';
            const card = document.createElement('div');
            card.className = `order-card ${isClaimed ? 'claimed' : ''}`;
            card.id = `order-card-${order.id}`;
            
            const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Build item rows
            let itemsHtml = '';
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    itemsHtml += `
                        <div class="item-row">
                            <div class="item-details">
                                <span class="item-title">${item.title}</span>
                                <span class="item-meta">Variant: ${item.attribute_str || 'Standard'}</span>
                            </div>
                            <div class="item-price-qty">
                                ${item.quantity}x @ ₱${Number(item.price).toFixed(2)}
                            </div>
                        </div>
                    `;
                });
            } else {
                itemsHtml = `<div class="item-row"><div class="item-details">No items found for this order.</div></div>`;
            }

            // Claim button configuration at the bottom
            const btnClass = isClaimed ? 'claim-btn claimed-btn' : 'claim-btn';
            const btnIcon = isClaimed ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-qrcode"></i>';
            const btnText = isClaimed ? 'Claimed' : 'Show Claim QR';
            const btnAction = isClaimed ? '' : `onclick="openQrModal(event, ${order.id})"`;

            card.innerHTML = `
                <div class="order-header" onclick="toggleAccordion(this)">
                    <div class="order-info">
                        <span class="order-id">Order #${order.id}</span>
                        <span class="order-date">${dateStr}</span>
                    </div>
                    <div class="header-right">
                        <span class="order-total">₱${Number(order.total_amount).toFixed(2)}</span>
                        <i class="fa-solid fa-chevron-down accordion-icon"></i>
                    </div>
                </div>
                <div class="order-body">
                    <div class="order-items-table">
                        ${itemsHtml}
                    </div>
                    <div class="order-footer">
                        <button id="qr-btn-${order.id}" class="${btnClass}" ${btnAction}>${btnIcon} ${btnText}</button>
                    </div>
                </div>
            `;
            
            ordersContainer.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        ordersContainer.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">Error loading orders.</div>`;
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Could not load your orders. Please try again later.');
        }
    }
}

function toggleAccordion(headerElement) {
    const card = headerElement.parentElement;
    card.classList.toggle('expanded');
}

async function openQrModal(event, orderId) {
    // Prevent the accordion from toggling if button clicked directly
    event.stopPropagation(); 
    
    try {
        // Double check database status before showing QR
        const response = await window.secureFetch(`/api/user/orders/${orderId}/status`);
        
        if (!response.ok) {
            throw new Error('Failed to verify order status.');
        }

        const data = await response.json();
        
        if (data.status === 'claimed') {
            // Dynamically update UI if it was claimed since page load
            const card = document.getElementById(`order-card-${orderId}`);
            const btn = document.getElementById(`qr-btn-${orderId}`);
            
            if (card) card.classList.add('claimed');
            if (btn) {
                btn.className = 'claim-btn claimed-btn';
                btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Claimed';
                btn.onclick = null; // Remove event listener
            }
            
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('This order has already been claimed.');
            }
            return; 
        }

        // If still confirmed, proceed to generate QR code
        const modal = document.getElementById('qrModal');
        const qrImage = document.getElementById('qrCodeImage');
        const idDisplay = document.getElementById('qrOrderIdDisplay');
        
        const qrData = `RHYTHM-SOUL-ORDER-${orderId}`;
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&color=0f1015&bgcolor=ffffff`;
        
        idDisplay.textContent = `Order #${orderId}`;
        modal.classList.add('active');

    } catch (err) {
        console.error(err);
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('An error occurred verifying your order. Please try again.');
        }
    }
}

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    modal.classList.remove('active');
}