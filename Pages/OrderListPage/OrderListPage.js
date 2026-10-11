document.addEventListener('DOMContentLoaded', async () => {
    // 1. Role Check
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Access Denied: Admins Only. Redirecting...');
        } else { alert('Access Denied: Admins Only.'); }
        setTimeout(() => window.location.href = '../LandingPage/LandingPage.html', 2000);
        return; 
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');

    const loadingState = document.getElementById('loadingState');
    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');

    // === MODE A: SINGLE ORDER DETAIL VIEW ===
    if (orderId) {
        document.getElementById('displayOrderId').textContent = orderId;
        const orderCard = document.getElementById('orderCard');
        const itemsList = document.getElementById('itemsList');
        const backToListBtn = document.getElementById('backToListBtn');
        const detailClaimBtn = document.getElementById('detailClaimBtn');

        backToListBtn.addEventListener('click', () => {
            window.location.href = 'OrderListPage.html';
        });

        try {
            const response = await window.secureFetch(`/api/admin/orders/${orderId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Failed to fetch order details.');

            document.getElementById('customerName').textContent = data.recipient_name;
            document.getElementById('customerPhone').textContent = data.phone;
            
            const statusBadge = document.getElementById('orderStatus');
            statusBadge.textContent = data.status === 'confirmed' ? 'Not Yet Claimed' : 'Claimed';
            
            if (data.status === 'claimed') {
                statusBadge.classList.add('claimed');
                orderCard.classList.add('claimed');
                detailClaimBtn.disabled = true;
                detailClaimBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Order Already Claimed';
                detailClaimBtn.style.background = '#334155';
                detailClaimBtn.style.color = '#94a3b8';
            }

            itemsList.innerHTML = '';
            data.items.forEach((item, index) => {
                const attrText = item.attributes ? ` | Variant: ${item.attributes}` : '';
                const itemHTML = `
                    <label class="checklist-item" for="item_${index}">
                        <input type="checkbox" id="item_${index}" class="item-checkbox" ${data.status === 'claimed' ? 'checked disabled' : ''}>
                        <div class="item-details">
                            <span class="item-title">${item.quantity}x ${item.title}</span>
                            <span class="item-meta">₱${Number(item.price * item.quantity).toFixed(2)}${attrText}</span>
                        </div>
                    </label>
                `;
                itemsList.insertAdjacentHTML('beforeend', itemHTML);
            });

            loadingState.style.display = 'none';
            detailView.style.display = 'block';
            orderCard.style.display = 'block';

            const checkboxes = document.querySelectorAll('.item-checkbox');

            function updateClaimButtonState() {
                if (data.status === 'claimed') return;
                const allChecked = Array.from(checkboxes).every(box => box.checked);
                detailClaimBtn.disabled = !allChecked;
            }

            if (data.status !== 'claimed') {
                checkboxes.forEach(box => {
                    box.addEventListener('change', (e) => {
                        if (e.target.checked) e.target.closest('.checklist-item').classList.add('checked');
                        else e.target.closest('.checklist-item').classList.remove('checked');
                        updateClaimButtonState();
                    });
                });
                updateClaimButtonState();
            }

            // Handle Detail Claim Button Click
            detailClaimBtn.addEventListener('click', async () => {
                if (detailClaimBtn.disabled) return;

                const confirmed = typeof window.showConfirmModal === 'function' 
                    ? await window.showConfirmModal('Have you handed over all items to the student?', 'Confirm Handover', 'Yes, Mark Claimed')
                    : confirm('Have you handed over all items?');
                if (!confirmed) return;

                try {
                    detailClaimBtn.disabled = true;
                    detailClaimBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

                    const res = await window.secureFetch(`/api/admin/orders/${orderId}/claim`, { method: 'PUT' });
                    const resultData = await res.json();

                    if (res.ok) {
                        if (typeof window.showSuccessModal === 'function') {
                            window.showSuccessModal('Success', 'Order successfully marked as claimed!');
                        } else {
                            alert('Order claimed successfully!');
                        }
                        setTimeout(() => window.location.href = 'OrderListPage.html', 1500);
                    } else {
                        throw new Error(resultData.message || 'Failed to claim order.');
                    }
                } catch (err) {
                    if (typeof window.showErrorModal === 'function') window.showErrorModal(err.message);
                    else alert(err.message);
                    detailClaimBtn.disabled = false;
                    detailClaimBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirm Checklist & Mark as Claimed';
                }
            });

        } catch (err) {
            loadingState.style.display = 'none';
            if (typeof window.showErrorModal === 'function') window.showErrorModal(err.message);
            else alert(err.message);
        }

    } 
    // === MODE B: MULTI-ORDER DASHBOARD VIEW ===
    else {
        loadingState.style.display = 'none';
        listView.style.display = 'block';

        let allOrders = [];
        const ordersGrid = document.getElementById('ordersGrid');
        const noOrdersMessage = document.getElementById('noOrdersMessage');

        // Modal & Filter elements
        const openFilterModal = document.getElementById('openFilterModal');
        const closeFilterModal = document.getElementById('closeFilterModal');
        const filterModal = document.getElementById('filterModal');
        const applyModalFilters = document.getElementById('applyModalFilters');
        const resetModalFilters = document.getElementById('resetModalFilters');
        const filterStatus = document.getElementById('filterStatus');
        const filterSort = document.getElementById('filterSort');

        // Camera Scanner elements
        const scanQrBtn = document.getElementById('scanQrBtn');
        const cameraScannerModal = document.getElementById('cameraScannerModal');
        const closeScannerModal = document.getElementById('closeScannerModal');
        let html5QrCode = null;

        if (openFilterModal) openFilterModal.addEventListener('click', () => filterModal.style.display = 'flex');
        if (closeFilterModal) closeFilterModal.addEventListener('click', () => filterModal.style.display = 'none');

        // Scan QR Button -> Open Camera Stream
        if (scanQrBtn) {
            scanQrBtn.addEventListener('click', async () => {
                cameraScannerModal.style.display = 'flex';
                if (!html5QrCode) {
                    html5QrCode = new Html5Qrcode("reader");
                }
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 250, height: 250 } },
                        (decodedText) => {
                            let scannedOrderId = decodedText.trim();
                            if (scannedOrderId.includes('RHYTHM-SOUL-ORDER-')) {
                                scannedOrderId = scannedOrderId.replace('RHYTHM-SOUL-ORDER-', '');
                            }

                            html5QrCode.stop().then(() => {
                                cameraScannerModal.style.display = 'none';
                                window.location.href = `?orderId=${scannedOrderId}`;
                            }).catch(() => {
                                window.location.href = `?orderId=${scannedOrderId}`;
                            });
                        },
                        () => {} // Ignore scan misses
                    );
                } catch (err) {
                    console.error("Camera access error:", err);
                    if (typeof window.showErrorModal === 'function') {
                        window.showErrorModal('Unable to access camera. Please check camera permissions.');
                    } else {
                        alert('Unable to access camera.');
                    }
                    cameraScannerModal.style.display = 'none';
                }
            });
        }

        if (closeScannerModal) {
            closeScannerModal.addEventListener('click', async () => {
                if (html5QrCode && html5QrCode.isScanning) {
                    await html5QrCode.stop().catch(err => console.error(err));
                }
                cameraScannerModal.style.display = 'none';
            });
        }

        window.addEventListener('click', async (e) => { 
            if (e.target === filterModal) filterModal.style.display = 'none';
            if (e.target === cameraScannerModal) {
                if (html5QrCode && html5QrCode.isScanning) {
                    await html5QrCode.stop().catch(err => console.error(err));
                }
                cameraScannerModal.style.display = 'none';
            }
        });

        async function fetchAllOrders() {
            try {
                const res = await window.secureFetch('/api/admin/orders');
                if (!res.ok) throw new Error('Failed to fetch orders.');
                allOrders = await res.json();
                applyFilters();
            } catch (err) {
                ordersGrid.innerHTML = `<p style="color: #ef4444; padding: 20px;">${err.message}</p>`;
            }
        }

        function applyFilters() {
            const selectedStatus = filterStatus.value;
            const selectedSort = filterSort.value;

            document.getElementById('summaryStatus').textContent = filterStatus.options[filterStatus.selectedIndex].text;
            document.getElementById('summarySort').textContent = filterSort.options[filterSort.selectedIndex].text;
            
            const badge = document.getElementById('activeFiltersBadge');
            badge.style.display = (selectedStatus !== '' || selectedSort !== 'newest') ? 'inline-block' : 'none';

            let filtered = allOrders.filter(order => !selectedStatus || order.status === selectedStatus);

            filtered.sort((a, b) => {
                if (selectedSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
                if (selectedSort === 'amount-high') return Number(b.total_amount) - Number(a.total_amount);
                if (selectedSort === 'amount-low') return Number(a.total_amount) - Number(b.total_amount);
                return new Date(b.created_at) - new Date(a.created_at);
            });

            renderGrid(filtered);
            filterModal.style.display = 'none';
        }

        function renderGrid(orders) {
            ordersGrid.innerHTML = '';
            if (orders.length === 0) {
                noOrdersMessage.style.display = 'block';
                return;
            }
            noOrdersMessage.style.display = 'none';

            orders.forEach(order => {
                const isClaimed = order.status === 'claimed';
                const card = document.createElement('div');
                card.className = `order-card ${isClaimed ? 'claimed' : ''}`;
                card.id = `order-card-${order.id}`;
                
                const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

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

                const statusText = isClaimed ? 'CLAIMED' : 'TO CLAIM';
                const badgeClass = isClaimed ? 'claimed' : '';

                card.innerHTML = `
                    <div class="order-header" onclick="toggleAccordion(this)">
                        <div class="order-header-top">
                            <span class="order-id">Order #${order.id}</span>
                            <div class="header-right-top">
                                <span class="status-badge ${badgeClass}">${statusText}</span>
                                <i class="fa-solid fa-chevron-down accordion-icon"></i>
                            </div>
                        </div>
                        <div class="order-divider"></div>
                        <div class="order-header-bottom">
                            <div class="order-info-group">
                                <span class="order-name">${order.recipient_name}</span>
                                <span class="order-date">${dateStr}</span>
                            </div>
                            <span class="order-total">₱${Number(order.total_amount).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="order-body">
                        <div class="order-items-table">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
                
                ordersGrid.appendChild(card);
            });
        }

        window.toggleAccordion = function(headerElement) {
            const card = headerElement.parentElement;
            card.classList.toggle('expanded');
        };

        window.markOrderClaimed = async function(event, orderId) {
            event.stopPropagation();
            const confirmed = typeof window.showConfirmModal === 'function' 
                ? await window.showConfirmModal('Have you handed over all items to the student?', 'Confirm Handover', 'Yes, Mark Claimed')
                : confirm('Have you handed over all items?');
            if (!confirmed) return;

            try {
                const btn = document.getElementById(`claim-btn-${orderId}`);
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
                }

                const response = await window.secureFetch(`/api/admin/orders/${orderId}/claim`, { method: 'PUT' });
                const data = await response.json();

                if (response.ok) {
                    if (typeof window.showSuccessModal === 'function') {
                        window.showSuccessModal('Success', 'Order marked as claimed successfully!');
                    } else {
                        alert('Order claimed!');
                    }
                    fetchAllOrders();
                } else {
                    throw new Error(data.message || 'Failed to claim order.');
                }
            } catch (err) {
                if (typeof window.showErrorModal === 'function') window.showErrorModal(err.message);
                else alert(err.message);
                fetchAllOrders();
            }
        };

        if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);
        if (resetModalFilters) {
            resetModalFilters.addEventListener('click', () => {
                filterStatus.value = '';
                filterSort.value = 'newest';
                applyFilters();
            });
        }

        fetchAllOrders();
    }
});