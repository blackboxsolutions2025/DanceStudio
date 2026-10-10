document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('venueId');

    const triggerErrorModal = (message, title = 'Error') => {
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal(message, title);
        } else {
            alert(message);
        }
    };

    const triggerSuccessModal = (message, title = 'Success') => {
        if (typeof window.showSuccessModal === 'function') {
            window.showSuccessModal(message, title);
        } else {
            alert(message);
        }
    };

    if (!venueId) {
        triggerErrorModal('No venue selected.', 'Selection Error');
        setTimeout(() => {
            window.location.href = '../VenueRentalPage/VenueRentalPage.html';
        }, 1500);
        return;
    }

    const venueName = document.getElementById('venueName');
    const venuePrice = document.getElementById('venuePrice');
    const mainVenueImg = document.getElementById('mainVenueImg');
    const galleryThumbnails = document.getElementById('galleryThumbnails');
    const rentalDate = document.getElementById('rentalDate');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const timeAnalysisBtn = document.getElementById('timeAnalysisBtn');
    const timeErrorMsg = document.getElementById('timeErrorMsg');
    
    // Modal elements
    const analysisModal = document.getElementById('analysisModal');
    const closeAnalysisModal = document.getElementById('closeAnalysisModal');
    const dismissAnalysisBtn = document.getElementById('dismissAnalysisBtn');
    const analysisModalBody = document.getElementById('analysisModalBody');

    // Summary & Checkout elements
    const checkoutSummary = document.getElementById('checkoutSummary');
    const selectedHoursCount = document.getElementById('selectedHoursCount');
    const totalPriceDisplay = document.getElementById('totalPriceDisplay');
    const proceedCheckoutBtn = document.getElementById('proceedCheckoutBtn');

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    rentalDate.min = today;
    rentalDate.value = today;

    let venueData = null;
    let hourlyRateVal = 1500.00;

    // Fetch Venue Details & Images
    try {
        const res = await secureFetch(`/api/venues/${venueId}`);
        if (!res.ok) throw new Error('Venue not found.');
        venueData = await res.json();

        venueName.textContent = venueData.name;
        hourlyRateVal = venueData.hourly_rate ? Number(venueData.hourly_rate) : 1500.00;
        
        const formattedRate = hourlyRateVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        venuePrice.textContent = `₱${formattedRate} / hr`;

        const defaultMainImg = venueData.image || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80';
        mainVenueImg.src = defaultMainImg;

        let images = [defaultMainImg];
        if (venueData.gallery_images && Array.isArray(venueData.gallery_images)) {
            const galleryPaths = venueData.gallery_images.map(img => img.image_path);
            images = images.concat(galleryPaths);
        } else {
            images.push(
                'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=600&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&auto=format&fit=crop&q=80'
            );
        }

        galleryThumbnails.innerHTML = '';
        images.forEach((imgUrl, index) => {
            const thumb = document.createElement('img');
            thumb.src = imgUrl;
            thumb.className = `gallery-thumb ${index === 0 ? 'active' : ''}`;
            thumb.addEventListener('click', () => {
                mainVenueImg.src = imgUrl;
                document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            galleryThumbnails.appendChild(thumb);
        });

    } catch (err) {
        console.error('Failed to load venue details:', err);
        triggerErrorModal('Could not load venue details.', 'Loading Error');
        setTimeout(() => {
            window.location.href = '../VenueRentalPage/VenueRentalPage.html';
        }, 1500);
    }

    const checkAnalysisButtonState = () => {
        if (rentalDate.value) {
            timeAnalysisBtn.removeAttribute('disabled');
        } else {
            timeAnalysisBtn.setAttribute('disabled', 'true');
        }
    };
    rentalDate.addEventListener('input', checkAnalysisButtonState);
    checkAnalysisButtonState();

    const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const period = h >= 12 && h < 24 ? 'PM' : 'AM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    };

    const formatDuration = (totalMins) => {
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        if (hrs === 0) return `${mins} minute${mins > 1 ? 's' : ''}`;
        if (mins === 0) return `${hrs} hour${hrs > 1 ? 's' : ''}`;
        return `${hrs} hour${hrs > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
    };

    const truncateText = (text, maxLength = 28) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Show Availability Modal Click Handler
    timeAnalysisBtn.addEventListener('click', async () => {
        const selectedDate = rentalDate.value;
        if (!selectedDate) {
            triggerErrorModal('Please select a rental date first.', 'Date Required');
            return;
        }

        try {
            const res = await secureFetch(`/api/venue-rentals/schedule?venue_id=${venueId}&date=${selectedDate}`);
            const data = await res.json();

            const classes = data.classes || [];
            const rentals = data.rentals || [];

            const bookedItems = [
                ...classes.map(c => ({
                    title: `Class: ${truncateText(c.title)}`,
                    start: timeToMins(c.start_time),
                    end: timeToMins(c.end_time),
                    startStr: formatTime(timeToMins(c.start_time)),
                    endStr: formatTime(timeToMins(c.end_time))
                })),
                ...rentals.map(r => ({
                    title: 'Private Venue Rental',
                    start: timeToMins(r.start_time),
                    end: timeToMins(r.end_time),
                    startStr: formatTime(timeToMins(r.start_time)),
                    endStr: formatTime(timeToMins(r.end_time))
                }))
            ].sort((a, b) => a.start - b.start);

            const openMinutes = 0; 
            const closeMinutes = 24 * 60;

            let freeSlots = [];
            let currentPointer = openMinutes;

            bookedItems.forEach(item => {
                if (item.start > currentPointer) {
                    freeSlots.push({ start: currentPointer, end: item.start });
                }
                if (item.end > currentPointer) {
                    currentPointer = item.end;
                }
            });

            if (currentPointer < closeMinutes) {
                freeSlots.push({ start: currentPointer, end: closeMinutes });
            }

            let html = `<p style="color: #94a3b8; margin-bottom: 12px; font-size: 0.9rem; text-align: center;">Date: <strong style="color:#ffffff;">${selectedDate}</strong></p>`;

            if (bookedItems.length > 0) {
                html += `<h4 style="color: #f87171; font-size: 0.85rem; margin-bottom: 8px; text-align: center;">Already Booked / Reserved Times:</h4>`;
                bookedItems.forEach(b => {
                    html += `
                        <div class="booked-slot-item">
                            <span class="slot-title"><i class="fa-solid fa-ban"></i> ${b.title}</span>
                            <span class="slot-time">${b.startStr} - ${b.endStr}</span>
                        </div>
                    `;
                });
            } else {
                html += `<p style="color: #10b981; font-size: 0.85rem; margin-bottom: 12px; text-align: center;"><i class="fa-solid fa-circle-check"></i> Venue is fully open on this date!</p>`;
            }

            html += `<h4 style="color: #34d399; font-size: 0.85rem; margin: 15px 0 8px 0; text-align: center;">Available Free Time Blocks:</h4>`;
            if (freeSlots.length === 0) {
                html += `<p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">No free time blocks available.</p>`;
            } else {
                freeSlots.forEach(slot => {
                    const duration = slot.end - slot.start;
                    html += `
                        <div class="free-slot-item">
                            <span class="slot-time"><i class="fa-solid fa-clock"></i> ${formatTime(slot.start)} — ${formatTime(slot.end)}</span>
                            <span class="slot-duration">${formatDuration(duration)} available</span>
                        </div>
                    `;
                });
            }

            analysisModalBody.innerHTML = html;
            analysisModal.classList.add('active');

        } catch (err) {
            console.error('Availability Analysis Error:', err);
            triggerErrorModal('Failed to analyze venue availability.', 'Server Error');
        }
    });

    const timeToMins = (timeStr) => {
        const parts = timeStr.split(':').map(Number);
        return parts[0] * 60 + parts[1];
    };

    const closeModalFn = () => analysisModal.classList.remove('active');
    closeAnalysisModal.addEventListener('click', closeModalFn);
    dismissAnalysisBtn.addEventListener('click', closeModalFn);
    analysisModal.addEventListener('click', (e) => {
        if (e.target === analysisModal) closeModalFn();
    });

    const calculatePricing = () => {
        const start = startTimeInput.value;
        const end = endTimeInput.value;
        const date = rentalDate.value;

        if (date && start) {
            // Check if the chosen start time is in the past
            if (isPastTime(date, start)) {
                timeErrorMsg.textContent = 'Error: Cannot select a start time that has already passed.';
                timeErrorMsg.style.display = 'block';
                checkoutSummary.style.display = 'none';
                return;
            }
        }

        if (start && end) {
            const startMins = timeToMins(start);
            const endMins = timeToMins(end);

            if (startMins >= endMins) {
                timeErrorMsg.textContent = 'Error: Start time must be earlier than end time.';
                timeErrorMsg.style.display = 'block';
                checkoutSummary.style.display = 'none';
                return;
            } else {
                timeErrorMsg.style.display = 'none';
            }

            const diffMins = endMins - startMins;
            const diffHoursDecimal = diffMins / 60;
            const totalPrice = diffHoursDecimal * hourlyRateVal;

            selectedHoursCount.textContent = formatDuration(diffMins);
            totalPriceDisplay.textContent = `₱${totalPrice.toFixed(2)}`;
            checkoutSummary.style.display = 'block';
            return;
        }

        timeErrorMsg.style.display = 'none';
        checkoutSummary.style.display = 'none';
    };

    startTimeInput.addEventListener('input', calculatePricing);
    endTimeInput.addEventListener('input', calculatePricing);

    // Proceed to Checkout / Booking
proceedCheckoutBtn.addEventListener('click', async () => {
        // Check if user is logged in via HttpOnly cookie using secureFetch
        try {
            const profileRes = await secureFetch('/api/user/profile');
            if (!profileRes.ok) {
                triggerErrorModal('Please log in to rent a venue.', 'Authentication Required');
                setTimeout(() => {
                    window.location.href = '../LoginPage/LoginPage.html';
                }, 1500);
                return;
            }
        } catch (err) {
            console.error('Auth check error:', err);
            triggerErrorModal('Please log in to rent a venue.', 'Authentication Required');
            setTimeout(() => {
                window.location.href = '../LoginPage/LoginPage.html';
            }, 1500);
            return;
        }

        const start = startTimeInput.value;
        const end = endTimeInput.value;
        const date = rentalDate.value;

        if (!date || !start || !end) {
            triggerErrorModal('Please fill in all rental date and time fields.', 'Missing Fields');
            return;
        }

        if (timeToMins(start) >= timeToMins(end)) {
            timeErrorMsg.textContent = 'Error: Start time must be earlier than end time.';
            timeErrorMsg.style.display = 'block';
            return;
        }

        // Check if start time is in the past
        if (isPastTime(date, start)) {
            timeErrorMsg.textContent = 'Error: Cannot select a start time that has already passed.';
            timeErrorMsg.style.display = 'block';
            triggerErrorModal('You cannot book a time slot that has already passed.', 'Invalid Time');
            return;
        }

        if (timeToMins(start) >= timeToMins(end)) {
            timeErrorMsg.textContent = 'Error: Start time must be earlier than end time.';
            timeErrorMsg.style.display = 'block';
            return;
        }

        const diffMins = timeToMins(end) - timeToMins(start);
        const totalPrice = (diffMins / 60) * hourlyRateVal;

        try {
            const res = await secureFetch('/api/venue-rentals', {
                method: 'POST',
                body: JSON.stringify({
                    venue_id: venueId,
                    rental_date: date,
                    start_time: start,
                    end_time: end,
                    total_price: totalPrice
                })
            });

            const data = await res.json();
            
            if (res.status === 401 || res.status === 403) {
                triggerErrorModal('Please log in to rent a venue.', 'Authentication Required');
                setTimeout(() => {
                    window.location.href = '../LoginPage/LoginPage.html';
                }, 1500);
                return;
            }

            if (res.ok && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                const message = data.message || 'Time conflict detected or failed to initiate checkout.';
                
                if (message.toLowerCase().includes('conflict') || message.toLowerCase().includes('booked')) {
                    // Plain text formatting using standard newlines for the global modal popup
                    const modalMessage = `${message}\n\n💡 Note: Please check the 'Show Availability' button above to inspect open schedule blocks for this date.`;
                    triggerErrorModal(modalMessage, 'Time Conflict');
                    
                    // HTML formatting is safe here since timeErrorMsg is a DOM element
                    timeErrorMsg.innerHTML = `${message}. <br>💡 Please check the <strong>'Show Availability'</strong> button to find open slots.`;
                    timeErrorMsg.style.display = 'block';
                } else {
                    triggerErrorModal(message, 'Booking Error');
                }
            }
        } catch (err) {
            console.error('Checkout error:', err);
            triggerErrorModal('Server error during checkout.', 'Network Error');
        }
    });

    // Helper function to check if selected date and start time are in the past
    const isPastTime = (dateStr, timeStr) => {
        if (!dateStr || !timeStr) return false;
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);
        const selectedDateTime = new Date(year, month - 1, day, hours, minutes, 0);
        return selectedDateTime < new Date();
    };
});