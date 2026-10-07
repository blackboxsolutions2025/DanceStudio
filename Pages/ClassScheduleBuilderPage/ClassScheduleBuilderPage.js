document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated and is an admin
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'admin') {
        if (typeof window.showErrorModal === 'function') {
            await window.showErrorModal('Access denied. Administrator privileges required.', 'Unauthorized');
        } else {
            alert('Access denied. Administrator privileges required.');
        }
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    const genreSelect = document.getElementById('genreid');
    const coachSelect = document.getElementById('coachid');
    const venueSelect = document.getElementById('venueid');
    const scheduleDateInput = document.getElementById('schedule_date');
    const timeAnalysisBtn = document.getElementById('timeAnalysisBtn');
    const classBuilderForm = document.getElementById('classBuilderForm');
    const cancelBtn = document.getElementById('cancelBtn');

    // Modal elements
    const analysisModal = document.getElementById('analysisModal');
    const closeAnalysisModal = document.getElementById('closeAnalysisModal');
    const dismissAnalysisBtn = document.getElementById('dismissAnalysisBtn');
    const analysisModalBody = document.getElementById('analysisModalBody');

    // Enable/disable Time Analysis button only when BOTH venue and date are selected
    const checkAnalysisButtonState = () => {
        if (scheduleDateInput.value && venueSelect.value) {
            timeAnalysisBtn.removeAttribute('disabled');
        } else {
            timeAnalysisBtn.setAttribute('disabled', 'true');
        }
    };

    scheduleDateInput.addEventListener('input', checkAnalysisButtonState);
    venueSelect.addEventListener('change', checkAnalysisButtonState);

    // 1. Fetch Relational Dropdown Data on Load
    async function fetchDropdownData() {
        try {
            // Fetch Genres[cite: 4]
            const genresRes = await fetch('/api/genres');
            if (genresRes.ok) {
                const genres = await genresRes.json();
                genres.forEach(genre => {
                    const option = document.createElement('option');
                    option.value = genre.id;
                    option.textContent = genre.name;
                    genreSelect.appendChild(option);
                });
            }

            // Fetch Coaches[cite: 4]
            const coachesRes = await fetch('/api/coaches');
            if (coachesRes.ok) {
                const coaches = await coachesRes.json();
                coaches.forEach(coach => {
                    const option = document.createElement('option');
                    option.value = coach.id;
                    option.textContent = coach.name;
                    coachSelect.appendChild(option);
                });
            }

            // Fetch Venues[cite: 4]
            const venuesRes = await fetch('/api/venues');
            if (venuesRes.ok) {
                const venues = await venuesRes.json();
                venues.forEach(venue => {
                    const option = document.createElement('option');
                    option.value = venue.id;
                    option.textContent = venue.name;
                    venueSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Error fetching dropdown data:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Failed to load form dropdown options from server.', 'Loading Error');
            }
        }
    }

    await fetchDropdownData();

    // Helper: Format minutes to 12-hour AM/PM string
    const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const period = h >= 12 && h < 24 ? 'PM' : 'AM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    };

    // Helper: Format duration precisely without rounding off to full hours
    const formatDuration = (totalMins) => {
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        if (hrs === 0) return `${mins} mins`;
        if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
        return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} mins`;
    };

    // 2. Time Analysis Click Handler
    timeAnalysisBtn.addEventListener('click', async () => {
        const selectedDate = scheduleDateInput.value;
        const selectedVenueId = venueSelect.value;
        const selectedVenueName = venueSelect.options[venueSelect.selectedIndex]?.text || 'Selected Venue';

        if (!selectedDate || !selectedVenueId) {
            alert('Please select both a date and a venue first.');
            return;
        }

        try {
            // Fetch both classes and confirmed venue rentals for this date and venue
            const res = await fetch(`/api/venue-rentals/schedule?venue_id=${selectedVenueId}&date=${selectedDate}`);
            const data = await res.json();
            const classes = data.classes || [];
            const rentals = data.rentals || [];

            // Full Day Operating Hours: 12:00 AM (0 mins) to 12:00 AM next day (1440 mins)
            const openMinutes = 0; 
            const closeMinutes = 24 * 60;

            // Map and sort booked items (classes + confirmed rentals)
            const bookedItems = [
                ...classes.map(c => {
                    const [sh, sm] = c.start_time.split(':').map(Number);
                    const [eh, em] = c.end_time.split(':').map(Number);
                    const startMins = sh * 60 + sm;
                    const endMins = eh * 60 + em;
                    return {
                        title: c.title,
                        start: startMins,
                        end: endMins,
                        startStr: formatTime(startMins),
                        endStr: formatTime(endMins),
                        durationStr: formatDuration(endMins - startMins)
                    };
                }),
                ...rentals.map(r => {
                    const [sh, sm] = r.start_time.split(':').map(Number);
                    const [eh, em] = r.end_time.split(':').map(Number);
                    const startMins = sh * 60 + sm;
                    const endMins = eh * 60 + em;
                    return {
                        title: 'Private Venue Rental',
                        start: startMins,
                        end: endMins,
                        startStr: formatTime(startMins),
                        endStr: formatTime(endMins),
                        durationStr: formatDuration(endMins - startMins)
                    };
                })
            ].sort((a, b) => a.start - b.start);

            // Calculate free slots
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

            // Build Modal HTML content
            let html = `<p style="color: #94a3b8; margin-bottom: 12px; font-size: 0.9rem; text-align: center;">Venue: <strong style="color:#ffffff;">${selectedVenueName}</strong><br>Date: <strong style="color:#ffffff;">${selectedDate}</strong></p>`;

            if (bookedItems.length > 0) {
                html += `<h4 style="color: #f87171; font-size: 0.85rem; margin-bottom: 8px; text-align: center;">Already Booked Times:</h4>`;
                bookedItems.forEach(b => {
                    html += `
                        <div class="booked-slot-item">
                            <span class="slot-title" title="${b.title}"><i class="fa-solid fa-ban"></i> ${b.title}</span>
                            <span class="slot-time">${b.startStr} — ${b.endStr}</span>
                            <span class="slot-duration">Duration: ${b.durationStr}</span>
                        </div>
                    `;
                });
            } else {
                html += `<p style="color: #10b981; font-size: 0.85rem; margin-bottom: 12px; text-align: center;"><i class="fa-solid fa-circle-check"></i> No classes or venue rentals booked for this venue on this date!</p>`;
            }

            html += `<h4 style="color: #34d399; font-size: 0.85rem; margin: 15px 0 8px 0; text-align: center;">Available Free Time Slots:</h4>`;
            if (freeSlots.length === 0) {
                html += `<p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">No free time slots available for this full day.</p>`;
            } else {
                freeSlots.forEach(slot => {
                    const slotDuration = slot.end - slot.start;
                    html += `
                        <div class="free-slot-item">
                            <span class="slot-time"><i class="fa-solid fa-clock"></i> ${formatTime(slot.start)} — ${formatTime(slot.end)}</span>
                            <span class="slot-duration">${formatDuration(slotDuration)} available</span>
                        </div>
                    `;
                });
            }

            analysisModalBody.innerHTML = html;
            analysisModal.classList.add('active');

        } catch (err) {
            console.error('Time Analysis Error:', err);
            alert('Failed to analyze venue schedule.');
        }
    });

    // Close Modal Events
    const closeModalFn = () => analysisModal.classList.remove('active');
    closeAnalysisModal.addEventListener('click', closeModalFn);
    dismissAnalysisBtn.addEventListener('click', closeModalFn);
    analysisModal.addEventListener('click', (e) => {
        if (e.target === analysisModal) closeModalFn();
    });

    // 3. Handle Cancel / Back Button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            try {
                const confirmed = typeof window.showConfirmModal === 'function'
                    ? await window.showConfirmModal('Are you sure you want to discard changes and return to the Class Schedule List?', 'Discard Changes', 'Discard', 'Stay')
                    : confirm('Are you sure you want to discard changes?');

                if (confirmed) {
                    window.location.href = '../ClassScheduleListPage/ClassScheduleListPage.html';
                }
            } catch (err) {
                console.error(err);
                window.location.href = '../ClassScheduleListPage/ClassScheduleListPage.html';
            }
        });
    }

    // 4. Handle Form Submission with Validation
    classBuilderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const genreid = document.getElementById('genreid').value;
        const coachid = document.getElementById('coachid').value;
        const venueid = document.getElementById('venueid').value;
        const schedule_date = scheduleDateInput.value;
        const start_time = document.getElementById('start_time').value;
        const end_time = document.getElementById('end_time').value;
        const capacity = parseInt(document.getElementById('capacity').value, 10);
        const price = parseFloat(document.getElementById('price').value);

        // Validation 1: Check if date is less than today
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayFormatted = `${year}-${month}-${day}`;

        if (schedule_date < todayFormatted) {
            if (typeof window.showErrorModal === 'function') {
                await window.showErrorModal('The schedule date cannot be earlier than today.', 'Invalid Date');
            } else {
                alert('The schedule date cannot be earlier than today.');
            }
            return;
        }

        // Validation 2: Check if start time is greater than or equal to end time
        if (start_time >= end_time) {
            if (typeof window.showErrorModal === 'function') {
                await window.showErrorModal('End time must be later than the start time.', 'Invalid Time Range');
            } else {
                alert('End time must be later than the start time.');
            }
            return;
        }

        const classData = {
            title,
            description: '',
            genreid: parseInt(genreid, 10),
            coachid: parseInt(coachid, 10),
            venueid: parseInt(venueid, 10),
            schedule_date,
            start_time,
            end_time,
            capacity,
            slots_remaining: capacity,
            price
        };

        try {
            const response = await fetch('/api/classes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(classData)
            });

            const result = await response.json();

            if (response.ok) {
                if (typeof window.showSuccessModal === 'function') {
                    await window.showSuccessModal('Class schedule successfully created!', 'Success');
                } else {
                    alert('Class schedule successfully created!');
                }
                window.location.href = '../ClassScheduleListPage/ClassScheduleListPage.html';
            } else {
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal(result.message || 'Failed to create class schedule.', 'Conflict Error');
                } else {
                    alert(result.message || 'Failed to create class schedule.');
                }
            }
        } catch (err) {
            console.error('Submit Error:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('A server error occurred while creating the class schedule.', 'Server Error');
            } else {
                alert('A server error occurred while creating the class schedule.');
            }
        }
    });
});