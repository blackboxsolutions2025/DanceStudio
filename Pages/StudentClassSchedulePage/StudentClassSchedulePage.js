document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    let allEnrollments = [];
    let currentFilteredEnrollments = [];
    let currentIndex = 0;
    let cardElements = [];
    let currentFilter = 'upcoming';

    const scheduleTrack = document.getElementById('scheduleTrack');
    const noClassesMessage = document.getElementById('noClassesMessage');
    const carouselCounter = document.getElementById('carouselCounter');
    const currentIndexDisplay = document.getElementById('currentIndexDisplay');
    const totalClassesDisplay = document.getElementById('totalClassesDisplay');
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Filter Modal Elements
    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryDate = document.getElementById('summaryDate');
    const summaryGenre = document.getElementById('summaryGenre');
    const summaryCoach = document.getElementById('summaryCoach');
    const summaryVenue = document.getElementById('summaryVenue');

    const filterDateRangeMode = document.getElementById('filterDateRangeMode');
    const customDateContainer = document.getElementById('customDateContainer');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterGenre = document.getElementById('filterGenre');
    const filterCoach = document.getElementById('filterCoach');
    const filterVenue = document.getElementById('filterVenue');

    // --- Modal Open/Close Event Listeners ---
    if (openFilterModal) openFilterModal.addEventListener('click', () => filterModal.style.display = 'flex');
    if (closeFilterModal) closeFilterModal.addEventListener('click', () => filterModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === filterModal) filterModal.style.display = 'none'; });

    if (filterDateRangeMode) {
        filterDateRangeMode.addEventListener('change', () => {
            if (filterDateRangeMode.value === 'custom') {
                customDateContainer.style.display = 'flex';
                if (!filterStartDate.value) filterStartDate.value = new Date().toISOString().split('T')[0];
                if (!filterEndDate.value) {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    filterEndDate.value = nextWeek.toISOString().split('T')[0];
                }
            } else {
                customDateContainer.style.display = 'none';
            }
        });
    }

    // --- Load Filter Options (Genres, Coaches, Venues) ---
    async function loadFilterOptions() {
        try {
            const [genreRes, coachRes, venueRes] = await Promise.all([
                fetch('/api/genres'), fetch('/api/coaches'), fetch('/api/venues')
            ]);

            if (genreRes.ok && filterGenre) {
                const genres = await genreRes.json();
                genres.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id; opt.textContent = g.name; filterGenre.appendChild(opt);
                });
            }

            if (coachRes.ok && filterCoach) {
                const coaches = await coachRes.json();
                coaches.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id; opt.textContent = c.name; filterCoach.appendChild(opt);
                });
            }

            if (venueRes.ok && filterVenue) {
                const venues = await venueRes.json();
                venues.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id; opt.textContent = v.name; filterVenue.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not load dynamic filter options from server:', err);
        }
    }

    // --- Fetch User Confirmed Schedule ---
    async function fetchUserSchedule() {
        try {
            const res = await fetch('/api/user/schedule', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.clear();
                    window.location.href = '../LoginPage/LoginPage.html';
                    return;
                }
                throw new Error('Failed to fetch schedule.');
            }

            allEnrollments = await res.json();
            applyFilters();
        } catch (err) {
            console.error('Error fetching schedule:', err);
            if (scheduleTrack) {
                scheduleTrack.innerHTML = '<p style="color: #f87171; text-align: center; width: 100%;">Failed to load your class schedule. Please try again later.</p>';
            }
        }
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [hour, minute] = timeStr.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${minute} ${ampm}`;
    }

    function getCardDateParts(dateStr) {
        const d = new Date(dateStr);
        return { 
            month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), 
            day: d.getDate() 
        };
    }

    // --- Validation & Apply Filters Logic ---
    function updateSummaryCardDisplay(rangeMode, genreText, coachText, venueText) {
        let rangeLabel = "Upcoming Classes";
        if (rangeMode === 'past') rangeLabel = "Past Classes";
        else if (rangeMode === 'all') rangeLabel = "All Classes";
        else if (rangeMode === 'today') rangeLabel = "This Day";
        else if (rangeMode === 'week') rangeLabel = "This Week";
        else if (rangeMode === 'month') rangeLabel = "This Month";
        else if (rangeMode === 'custom') {
            const from = filterStartDate && filterStartDate.value ? filterStartDate.value : 'Start';
            const to = filterEndDate && filterEndDate.value ? filterEndDate.value : 'End';
            rangeLabel = `${from} to ${to}`;
        }

        if (summaryDate) summaryDate.textContent = rangeLabel;
        if (summaryGenre) summaryGenre.textContent = genreText;
        if (summaryCoach) summaryCoach.textContent = coachText;
        if (summaryVenue) summaryVenue.textContent = venueText;
        
        const isDefault = (
            rangeMode === 'upcoming' && 
            (!filterGenre || filterGenre.value === '') && 
            (!filterCoach || filterCoach.value === '') &&
            (!filterVenue || filterVenue.value === '')
        );
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';
    }

    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'upcoming';
        const selectedGenre = filterGenre ? filterGenre.value : '';
        const selectedCoach = filterCoach ? filterCoach.value : '';
        const selectedVenue = filterVenue ? filterVenue.value : '';

        const genreLabel = filterGenre && selectedGenre ? filterGenre.options[filterGenre.selectedIndex].text : "All Genres";
        const coachLabel = filterCoach && selectedCoach ? filterCoach.options[filterCoach.selectedIndex].text : "All Coaches";
        const venueLabel = filterVenue && selectedVenue ? filterVenue.options[filterVenue.selectedIndex].text : "All Venues";

        updateSummaryCardDisplay(rangeMode, genreLabel, coachLabel, venueLabel);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // --- Validation Rules ---
        if (rangeMode === 'past' && filterStartDate && filterStartDate.value) {
            const startVal = new Date(filterStartDate.value);
            startVal.setHours(0, 0, 0, 0);
            if (startVal > today) {
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Error: The selected date is greater than today while Past Classes is selected.');
                } else {
                    alert('Error: The selected date is greater than today while Past Classes is selected.');
                }
                return;
            }
        } else if (rangeMode === 'upcoming' && filterStartDate && filterStartDate.value) {
            const startVal = new Date(filterStartDate.value);
            startVal.setHours(0, 0, 0, 0);
            if (startVal < today) {
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Error: The selected date is less than today while Upcoming Classes is selected.');
                } else {
                    alert('Error: The selected date is less than today while Upcoming Classes is selected.');
                }
                return;
            }
        }

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const filtered = allEnrollments.filter(item => {
            const clsDate = new Date(item.schedule_date);
            clsDate.setHours(0, 0, 0, 0);

            let matchDate = true;

            if (rangeMode === 'upcoming') {
                matchDate = clsDate >= today;
            } else if (rangeMode === 'past') {
                matchDate = clsDate < today;
            } else if (rangeMode === 'all') {
                matchDate = true;
            } else if (rangeMode === 'today') {
                matchDate = clsDate.getTime() === today.getTime();
            } else if (rangeMode === 'week') {
                matchDate = clsDate >= startOfWeek && clsDate <= endOfWeek;
            } else if (rangeMode === 'month') {
                matchDate = clsDate >= startOfMonth && clsDate <= endOfMonth;
            } else if (rangeMode === 'custom' && filterStartDate && filterEndDate) {
                const startVal = filterStartDate.value ? new Date(filterStartDate.value) : null;
                const endVal = filterEndDate.value ? new Date(filterEndDate.value) : null;
                if (startVal) startVal.setHours(0, 0, 0, 0);
                if (endVal) endVal.setHours(0, 0, 0, 0);

                if (startVal && endVal) {
                    matchDate = clsDate >= startVal && clsDate <= endVal;
                } else if (startVal) {
                    matchDate = clsDate >= startVal;
                } else if (endVal) {
                    matchDate = clsDate <= endVal;
                }
            }

            const matchGenre = !selectedGenre || String(item.genreid) === String(selectedGenre);
            // Note: student schedules use item.coach_id and item.venue_id
            const matchCoach = !selectedCoach || String(item.coach_id) === String(selectedCoach);
            const matchVenue = !selectedVenue || String(item.venue_id) === String(selectedVenue);
            
            return matchDate && matchGenre && matchCoach && matchVenue;
        });

        renderCarousel(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterDateRangeMode) filterDateRangeMode.value = 'upcoming';
            if (customDateContainer) customDateContainer.style.display = 'none';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            if (filterGenre) filterGenre.value = '';
            if (filterCoach) filterCoach.value = '';
            if (filterVenue) filterVenue.value = '';
            applyFilters();
        });
    }

    // --- Pre-load All Cards into Carousel DOM ---
    function renderCarousel(enrollmentsToRender) {
        currentFilteredEnrollments = enrollmentsToRender; // <-- Add this line to fix dragging/panning bounds
        if (!scheduleTrack) return;
        scheduleTrack.innerHTML = '';
        cardElements = [];

        if (enrollmentsToRender.length === 0) {
            if (noClassesMessage) noClassesMessage.style.display = 'block';
            if (carouselCounter) carouselCounter.style.display = 'none';
            return;
        }

        if (noClassesMessage) noClassesMessage.style.display = 'none';
        if (carouselCounter) carouselCounter.style.display = 'block';
        if (totalClassesDisplay) totalClassesDisplay.textContent = enrollmentsToRender.length;

        enrollmentsToRender.forEach((item, idx) => {
            const { month, day } = getCardDateParts(item.schedule_date);
            const classImage = item.coach_class_image || item.coach_user_image || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600';
            const imagePosition = item.coach_image_position || '50% 50%';

            // Determine if the class is past due
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const classDate = new Date(item.schedule_date);
            classDate.setHours(0, 0, 0, 0);
            const isPastDue = (classDate < today) || (currentFilter === 'past');

            const card = document.createElement('div');
            card.className = 'class-card-custom';
            card.dataset.index = idx;

            card.innerHTML = `
                <div class="card-image-container">
                    <img src="${classImage}" alt="${item.title}" class="card-bg-img" style="object-position: ${imagePosition};" draggable="false">
                    <div class="card-gradient-overlay"></div>
                    <div class="card-genre-badge">
                        <span>${item.genre_name || 'DANCE CLASS'}</span>
                    </div>
                    <div class="card-date-badge">
                        <span class="date-month">${month}</span>
                        <span class="date-day">${day}</span>
                    </div>
                </div>
                <div class="card-content-area">
                    <h3 class="card-title" title="${item.title}">${item.title}</h3>
                    
                    <div class="card-time-pill">
                        <i class="fas fa-clock"></i> ${formatTime(item.start_time)} - ${formatTime(item.end_time)}
                    </div>

                    <div class="card-footer-info">
                        <div class="card-instructor-venue">
                            <span class="card-coach"><i class="fas fa-chalkboard-teacher"></i> Coach ${item.coach_name || 'Instructor'}</span>
                            <span class="card-venue"><i class="fas fa-map-marker-alt"></i> ${item.venue_name || 'Main Studio'}</span>
                        </div>
                    </div>

                    <button class="btn-calendar" data-class-info='${encodeURIComponent(JSON.stringify(item))}' ${isPastDue ? 'disabled' : ''}>
                        <i class="fas ${isPastDue ? 'fa-calendar-xmark' : 'fa-calendar-plus'}"></i> ${isPastDue ? 'Past Due' : 'Add to Calendar'}
                    </button>

                    <button class="btn-attendance" data-class-id="${item.class_id}" data-attendance-status="${item.attendance_status || 'none'}">
                        <i class="fas fa-qrcode"></i> <span class="attendance-btn-text">Time-In Attendance</span>
                    </button>
                </div>
            `;

            // Calendar Download Action (only active if not past due)
            const calendarBtn = card.querySelector('.btn-calendar');
            if (calendarBtn && !isPastDue) {
                calendarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const enrollmentData = JSON.parse(decodeURIComponent(e.currentTarget.dataset.classInfo));
                    downloadICSFile(enrollmentData);
                });
            }

            // Card Click Navigation
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-calendar')) return;
                const clickedIdx = parseInt(card.dataset.index, 10);
                if (clickedIdx !== currentIndex) {
                    currentIndex = clickedIdx;
                    updateCardPositions(currentIndex, true);
                }
            });

            scheduleTrack.appendChild(card);
            cardElements.push(card);
        });

        updateCardPositions(currentIndex, false);
    }

    // --- 3D Carousel Physics Math ---
    function updateCardPositions(vIndex, animate = false) {
        const isMobile = window.innerWidth <= 768;
        const spacing = isMobile ? 75 : 88;
        const scaleDropoff = isMobile ? 0.1 : 0.14;
        const rotationBase = isMobile ? 5 : 10;

        cardElements.forEach((card, idx) => {
            const d = idx - vIndex;
            const absD = Math.abs(d);
            
            card.style.transition = animate 
                ? 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease, filter 0.5s ease' 
                : 'none';
            
            const scale = Math.max(0.4, 1 - (absD * scaleDropoff));
            const rotateY = -d * rotationBase; 
            const translateX = d * spacing;
            
            const opacity = absD === 0 ? 1 : Math.max(0.1, 1 - (absD * 0.3));
            const blurAmount = Math.min(6, absD * 1.5);
            const zIndex = 100 - Math.round(absD * 10);
            
            card.style.transform = `translateX(${translateX}%) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity = opacity;
            card.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';
            card.style.zIndex = zIndex;
            
            card.style.pointerEvents = absD > 3.5 ? 'none' : 'auto';
            card.style.cursor = absD > 0 && absD <= 3.5 ? 'pointer' : 'default';

            if (Math.round(vIndex) === idx) {
                card.classList.add('card-active');
                card.style.cursor = 'default';
            } else {
                card.classList.remove('card-active');
            }
        });

        if (currentIndexDisplay) currentIndexDisplay.textContent = Math.round(vIndex) + 1;
    }

    // --- Touch & Drag Navigation System ---
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let dragStartIndex = 0;

    if (scheduleTrack) {
        scheduleTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isDragging = true;
            dragStartIndex = currentIndex;
        }, { passive: true });

        scheduleTrack.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const dragOffset = currentX - startX;
            const maxOffset = window.innerWidth <= 768 ? 200 : 300; 
            const indexShift = -dragOffset / maxOffset;
            let vIndex = dragStartIndex + indexShift;
            
            if (vIndex < 0) vIndex *= 0.3; 
            if (vIndex > currentFilteredEnrollments.length - 1) {
                const overflow = vIndex - (currentFilteredEnrollments.length - 1);
                vIndex = (currentFilteredEnrollments.length - 1) + overflow * 0.3;
            }

            updateCardPositions(vIndex, false);
        }, { passive: true });

        scheduleTrack.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const dragOffset = currentX - startX;
            const maxOffset = window.innerWidth <= 768 ? 200 : 300;
            const indexShift = -dragOffset / maxOffset;
            let finalIndex = Math.round(dragStartIndex + indexShift);

            if (Math.abs(indexShift) < 0.5 && Math.abs(dragOffset) > 40) {
               finalIndex = dragOffset < 0 ? dragStartIndex + 1 : dragStartIndex - 1;
            }

            finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredEnrollments.length - 1));
            currentIndex = finalIndex;
            updateCardPositions(currentIndex, true);
        });

        scheduleTrack.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            currentX = startX;
            isDragging = true;
            dragStartIndex = currentIndex;
            e.preventDefault();
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
        const dragOffset = currentX - startX;
        const maxOffset = window.innerWidth <= 768 ? 200 : 300;
        const indexShift = -dragOffset / maxOffset;
        let vIndex = dragStartIndex + indexShift;
        
        if (vIndex < 0) vIndex *= 0.3; 
        if (vIndex > currentFilteredEnrollments.length - 1) {
            const overflow = vIndex - (currentFilteredEnrollments.length - 1);
            vIndex = (currentFilteredEnrollments.length - 1) + overflow * 0.3;
        }

        updateCardPositions(vIndex, false);
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        
        const dragOffset = currentX - startX;
        const maxOffset = window.innerWidth <= 768 ? 200 : 300;
        const indexShift = -dragOffset / maxOffset;
        let finalIndex = Math.round(dragStartIndex + indexShift);

        if (Math.abs(indexShift) < 0.5 && Math.abs(dragOffset) > 40) {
            finalIndex = dragOffset < 0 ? dragStartIndex + 1 : dragStartIndex - 1;
        }
        finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredEnrollments.length - 1));
        
        currentIndex = finalIndex;
        updateCardPositions(currentIndex, true);
    });

    // --- .ics Calendar File Generation with Alarms ---
    function downloadICSFile(item) {
        try {
            const dateStr = item.schedule_date.split('T')[0].replace(/-/g, '');
            const startTimeStr = item.start_time.replace(/:/g, '');
            const endTimeStr = item.end_time.replace(/:/g, '');

            const dtstart = `${dateStr}T${startTimeStr}`;
            const dtend = `${dateStr}T${endTimeStr}`;
            const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

            const summary = item.title;
            const description = `Dance class with Coach ${item.coach_name} at ${item.venue_name}. Enrolled via Rhythm & Soul Dance Studio.`;
            const location = item.venue_name;
            const uid = `class-${item.class_id}-${item.enrollment_id}-rhythmsoul@local`;

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Rhythm & Soul Dance Studio//Student Schedule//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${dtstamp}`,
                `DTSTART:${dtstart}`,
                `DTEND:${dtend}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${description}`,
                `LOCATION:${location}`,
                'BEGIN:VALARM',
                'TRIGGER:-P1D',
                'ACTION:DISPLAY',
                `DESCRIPTION:Reminder: ${summary} is tomorrow!`,
                'END:VALARM',
                'BEGIN:VALARM',
                'TRIGGER:-PT1H',
                'ACTION:DISPLAY',
                `DESCRIPTION:Reminder: ${summary} starts in 1 hour!`,
                'END:VALARM',
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${item.title.replace(/[^a-zA-Z0-9]/g, '_')}_Schedule.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error generating .ics file:', err);
            alert('Failed to generate calendar file. Please try again.');
        }
    }

    // --- Tab Filtering Listeners ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-tab');
            applyFilters();
        });
    });

    loadFilterOptions();
    fetchUserSchedule();

    let html5QrCode = null;
    let activeScanningClassId = null;

    function updateAttendanceButtonStyle(btn, status) {
        const textSpan = btn.querySelector('.attendance-btn-text');
        const icon = btn.querySelector('i');
        
        if (status === 'timed_in') {
            btn.className = 'btn-attendance time-out-mode';
            icon.className = 'fas fa-sign-out-alt';
            textSpan.textContent = 'Time-Out Attendance';
            btn.dataset.attendanceStatus = 'timed_in';
        } else if (status === 'completed') {
            btn.className = 'btn-attendance completed-mode';
            icon.className = 'fas fa-check-circle';
            textSpan.textContent = 'Attendance Completed';
            btn.dataset.attendanceStatus = 'completed';
        } else {
            btn.className = 'btn-attendance';
            icon.className = 'fas fa-qrcode';
            textSpan.textContent = 'Time-In Attendance';
            btn.dataset.attendanceStatus = 'none';
        }
    }

    function openQrScannerModal() {
        const modal = document.getElementById('qrScannerModal');
        modal.style.display = 'flex';

        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                await stopQrScanner();
                submitAttendance(activeScanningClassId, decodedText);
            },
            (errorMessage) => {
                // Ignore scanning framing errors
            }
        ).catch(err => {
            console.error("Camera start error:", err);
            document.getElementById('scannerStatus').textContent = "Unable to access camera.";
        });
    }

    async function stopQrScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
            html5QrCode.clear();
        }
        document.getElementById('qrScannerModal').style.display = 'none';
    }

    const closeQrModalBtn = document.getElementById('closeQrModal');
    const cancelQrScanBtn = document.getElementById('cancelQrScan');
    if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', stopQrScanner);
    if (cancelQrScanBtn) cancelQrScanBtn.addEventListener('click', stopQrScanner);

    async function submitAttendance(classId, qrData) {
        try {
            const res = await fetch('/api/attendance/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ class_id: classId, qr_code: qrData })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to record attendance.');

            if (typeof showSuccessModal === 'function') {
                showSuccessModal(data.message);
            } else {
                alert(data.message);
            }

            fetchUserSchedule();
        } catch (err) {
            console.error('Attendance Error:', err);
            if (typeof showErrorModal === 'function') {
                showErrorModal(err.message);
            } else {
                alert(err.message);
            }
        }
    }

    // --- Pre-load All Cards into Carousel DOM ---
    function renderCarousel(enrollmentsToRender) {
        currentFilteredEnrollments = enrollmentsToRender;
        if (!scheduleTrack) return;
        scheduleTrack.innerHTML = '';
        cardElements = [];

        if (enrollmentsToRender.length === 0) {
            if (noClassesMessage) noClassesMessage.style.display = 'block';
            if (carouselCounter) carouselCounter.style.display = 'none';
            return;
        }

        if (noClassesMessage) noClassesMessage.style.display = 'none';
        if (carouselCounter) carouselCounter.style.display = 'block';
        if (totalClassesDisplay) totalClassesDisplay.textContent = enrollmentsToRender.length;

        enrollmentsToRender.forEach((item, idx) => {
            const { month, day } = getCardDateParts(item.schedule_date);
            const classImage = item.coach_class_image || item.coach_user_image || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600';
            const imagePosition = item.coach_image_position || '50% 50%';

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const classDate = new Date(item.schedule_date);
            classDate.setHours(0, 0, 0, 0);
            const isPastDue = (classDate < today) || (currentFilter === 'past');

            const card = document.createElement('div');
            card.className = 'class-card-custom';
            card.dataset.index = idx;

            card.innerHTML = `
                <div class="card-image-container">
                    <img src="${classImage}" alt="${item.title}" class="card-bg-img" style="object-position: ${imagePosition};" draggable="false">
                    <div class="card-gradient-overlay"></div>
                    <div class="card-genre-badge">
                        <span>${item.genre_name || 'DANCE CLASS'}</span>
                    </div>
                    <div class="card-date-badge">
                        <span class="date-month">${month}</span>
                        <span class="date-day">${day}</span>
                    </div>
                </div>
                <div class="card-content-area">
                    <h3 class="card-title" title="${item.title}">${item.title}</h3>
                    
                    <div class="card-time-pill">
                        <i class="fas fa-clock"></i> ${formatTime(item.start_time)} - ${formatTime(item.end_time)}
                    </div>

                    <div class="card-footer-info">
                        <div class="card-instructor-venue">
                            <span class="card-coach"><i class="fas fa-chalkboard-teacher"></i> Coach ${item.coach_name || 'Instructor'}</span>
                            <span class="card-venue"><i class="fas fa-map-marker-alt"></i> ${item.venue_name || 'Main Studio'}</span>
                        </div>
                    </div>

                    <button class="btn-calendar" data-class-info='${encodeURIComponent(JSON.stringify(item))}' ${isPastDue ? 'disabled' : ''}>
                        <i class="fas ${isPastDue ? 'fa-calendar-xmark' : 'fa-calendar-plus'}"></i> ${isPastDue ? 'Past Due' : 'Add to Calendar'}
                    </button>

                    <button class="btn-attendance" data-class-id="${item.class_id}" data-attendance-status="${item.attendance_status || 'none'}">
                        <i class="fas fa-qrcode"></i> <span class="attendance-btn-text">Time-In Attendance</span>
                    </button>
                </div>
            `;

            // Calendar Download Action
            const calendarBtn = card.querySelector('.btn-calendar');
            if (calendarBtn && !isPastDue) {
                calendarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const enrollmentData = JSON.parse(decodeURIComponent(e.currentTarget.dataset.classInfo));
                    downloadICSFile(enrollmentData);
                });
            }

            // Attendance Button Action
            const attendanceBtn = card.querySelector('.btn-attendance');
            updateAttendanceButtonStyle(attendanceBtn, item.attendance_status);

            attendanceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const classId = e.currentTarget.dataset.classId;
                const currentStatus = e.currentTarget.dataset.attendanceStatus;

                if (currentStatus === 'completed') return;

                activeScanningClassId = classId;
                openQrScannerModal();
            });

            // Card Click Navigation
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-calendar') || e.target.closest('.btn-attendance')) return;
                const clickedIdx = parseInt(card.dataset.index, 10);
                if (clickedIdx !== currentIndex) {
                    currentIndex = clickedIdx;
                    updateCardPositions(currentIndex, true);
                }
            });

            scheduleTrack.appendChild(card);
            cardElements.push(card);
        });

        updateCardPositions(currentIndex, false);
    }
});