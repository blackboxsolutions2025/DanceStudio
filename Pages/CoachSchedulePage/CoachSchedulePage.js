document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'coach') {
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    let allClasses = [];
    let currentFilteredClasses = [];
    let currentIndex = 0;
    let cardElements = [];
    let currentFilter = 'upcoming';

    const scheduleTrack = document.getElementById('scheduleTrack');
    const noClassesMessage = document.getElementById('noClassesMessage');
    const carouselCounter = document.getElementById('carouselCounter');
    const currentIndexDisplay = document.getElementById('currentIndexDisplay');
    const totalClassesDisplay = document.getElementById('totalClassesDisplay');

    // Filter Modal Elements
    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryDate = document.getElementById('summaryDate');
    const summaryGenre = document.getElementById('summaryGenre');
    const summaryVenue = document.getElementById('summaryVenue');

    const filterDateRangeMode = document.getElementById('filterDateRangeMode');
    const customDateContainer = document.getElementById('customDateContainer');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterGenre = document.getElementById('filterGenre');
    const filterVenue = document.getElementById('filterVenue');

    // QR Modal Elements
    const qrDisplayModal = document.getElementById('qrDisplayModal');
    const closeQrModal = document.getElementById('closeQrModal');
    const doneQrBtn = document.getElementById('doneQrBtn');
    const qrcodeContainer = document.getElementById('qrcodeContainer');
    const qrModalTitle = document.getElementById('qrModalTitle');
    const qrClassDetails = document.getElementById('qrClassDetails');
    let qrInstance = null;

    // --- Attendee & Override Modal Elements ---
    const attendeeOverrideModal = document.getElementById('attendeeOverrideModal');
    const closeAttendeeModal = document.getElementById('closeAttendeeModal');
    const attendeeListContainer = document.getElementById('attendeeListContainer');
    const attendeeModalSubtitle = document.getElementById('attendeeModalSubtitle');
    let activeClassForOverride = null;

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

    async function loadFilterOptions() {
        try {
            const [genreRes, venueRes] = await Promise.all([
                fetch('/api/genres'), fetch('/api/venues')
            ]);

            if (genreRes.ok && filterGenre) {
                const genres = await genreRes.json();
                genres.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id; opt.textContent = g.name; filterGenre.appendChild(opt);
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
            console.warn('Could not load dynamic filter options:', err);
        }
    }

    async function fetchCoachSchedule() {
        try {
            const res = await fetch('/api/coach/schedule', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.clear();
                    window.location.href = '../LoginPage/LoginPage.html';
                    return;
                }
                throw new Error('Failed to fetch coach schedule.');
            }

            allClasses = await res.json();
            applyFilters();
        } catch (err) {
            console.error('Error fetching coach schedule:', err);
            if (scheduleTrack) {
                scheduleTrack.innerHTML = '<p style="color: #f87171; text-align: center; width: 100%;">Failed to load your schedule. Please try again later.</p>';
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

    function updateSummaryCardDisplay(rangeMode, genreText, venueText) {
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
        if (summaryVenue) summaryVenue.textContent = venueText;
        
        const isDefault = (
            rangeMode === 'upcoming' && 
            (!filterGenre || filterGenre.value === '') && 
            (!filterVenue || filterVenue.value === '')
        );
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';
    }

    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'upcoming';
        const selectedGenre = filterGenre ? filterGenre.value : '';
        const selectedVenue = filterVenue ? filterVenue.value : '';

        const genreLabel = filterGenre && selectedGenre ? filterGenre.options[filterGenre.selectedIndex].text : "All Genres";
        const venueLabel = filterVenue && selectedVenue ? filterVenue.options[filterVenue.selectedIndex].text : "All Venues";

        updateSummaryCardDisplay(rangeMode, genreLabel, venueLabel);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const filtered = allClasses.filter(item => {
            const clsDate = new Date(item.schedule_date);
            clsDate.setHours(0, 0, 0, 0);

            let matchDate = true;
            if (rangeMode === 'upcoming') matchDate = clsDate >= today;
            else if (rangeMode === 'past') matchDate = clsDate < today;
            else if (rangeMode === 'all') matchDate = true;
            else if (rangeMode === 'today') matchDate = clsDate.getTime() === today.getTime();
            else if (rangeMode === 'week') matchDate = clsDate >= startOfWeek && clsDate <= endOfWeek;
            else if (rangeMode === 'month') matchDate = clsDate >= startOfMonth && clsDate <= endOfMonth;
            else if (rangeMode === 'custom' && filterStartDate && filterEndDate) {
                const startVal = filterStartDate.value ? new Date(filterStartDate.value) : null;
                const endVal = filterEndDate.value ? new Date(filterEndDate.value) : null;
                if (startVal) startVal.setHours(0, 0, 0, 0);
                if (endVal) endVal.setHours(0, 0, 0, 0);

                if (startVal && endVal) matchDate = clsDate >= startVal && clsDate <= endVal;
                else if (startVal) matchDate = clsDate >= startVal;
                else if (endVal) matchDate = clsDate <= endVal;
            }

            const matchGenre = !selectedGenre || String(item.genreid) === String(selectedGenre);
            const matchVenue = !selectedVenue || String(item.venue_id) === String(selectedVenue);
            
            return matchDate && matchGenre && matchVenue;
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
            if (filterVenue) filterVenue.value = '';
            applyFilters();
        });
    }

    // --- Determine QR Code State based on Coach Time Window ---
    function getQrCodeButtonState(item) {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nowPHT = new Date(utcTime + (3600000 * 8));

        const [year, month, day] = item.schedule_date.split('T')[0].split('-').map(Number);
        const [startHour, startMin] = item.start_time.split(':').map(Number);
        const [endHour, endMin] = item.end_time.split(':').map(Number);

        const startDateTime = new Date(year, month - 1, day, startHour, startMin, 0);
        const endDateTime = new Date(year, month - 1, day, endHour, endMin, 0);
        const timeInOpenTime = new Date(startDateTime.getTime() - 30 * 60000);

        const isSameDay = nowPHT.toDateString() === startDateTime.toDateString();

        if (nowPHT < timeInOpenTime) {
            return { type: 'locked', text: 'QR Opens 30m Prior', disabled: true, modeClass: 'disabled-btn' };
        } else if (nowPHT >= timeInOpenTime && nowPHT <= endDateTime) {
            return { type: 'time_in', text: 'Time-In QR Code', disabled: false, modeClass: '' };
        } else if (isSameDay && nowPHT > endDateTime) {
            return { type: 'time_out', text: 'Time-Out QR Code', disabled: false, modeClass: 'timeout-btn' };
        } else if (nowPHT > endDateTime) {
            return { type: 'ended', text: 'Class Ended', disabled: true, modeClass: 'disabled-btn' };
        }
        return { type: 'locked', text: 'Not Available', disabled: true, modeClass: 'disabled-btn' };
    }

    // --- Validate if Override is Allowed (Strictly on class date AND after end time) ---
    function canPerformOverride(item) {
        if (!item || !item.schedule_date || !item.end_time) return true; // Allow if data is incomplete

        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nowPHT = new Date(utcTime + (3600000 * 8));

        let dateStr = item.schedule_date;
        if (dateStr instanceof Date) {
            dateStr = dateStr.toISOString();
        }
        const datePart = String(dateStr).split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        
        const [endHour, endMin] = String(item.end_time).split(':').map(Number);
        const endDateTime = new Date(year, month - 1, day, endHour || 0, endMin || 0, 0);

        // Override is allowed only if current PHT time is greater than or equal to class end time
        return nowPHT >= endDateTime;
    }

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
            const description = `Assigned coaching session for ${item.title} at ${item.venue_name || 'Main Studio'}. Managed via Rhythm & Soul Dance Studio.`;
            const location = item.venue_name || 'Main Studio';
            const uid = `coach-class-${item.id}-rhythmsoul@local`;

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Rhythm & Soul Dance Studio//Coach Schedule//EN',
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
            a.download = `${item.title.replace(/[^a-zA-Z0-9]/g, '_')}_Coach_Schedule.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error generating .ics file:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Failed to generate calendar file. Please try again.', 'Calendar Error');
            } else {
                alert('Failed to generate calendar file. Please try again.');
            }
        }
    }

    function renderCarousel(classesToRender) {
        currentFilteredClasses = classesToRender;
        if (!scheduleTrack) return;
        scheduleTrack.innerHTML = '';
        cardElements = [];

        if (classesToRender.length === 0) {
            if (noClassesMessage) noClassesMessage.style.display = 'block';
            if (carouselCounter) carouselCounter.style.display = 'none';
            return;
        }

        if (noClassesMessage) noClassesMessage.style.display = 'none';
        if (carouselCounter) carouselCounter.style.display = 'block';
        if (totalClassesDisplay) totalClassesDisplay.textContent = classesToRender.length;

        classesToRender.forEach((item, idx) => {
            const { month, day } = getCardDateParts(item.schedule_date);
            const classImage = item.coach_class_image || item.coach_user_image || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600';
            const imagePosition = item.coach_image_position || '50% 50%';

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const classDate = new Date(item.schedule_date);
            classDate.setHours(0, 0, 0, 0);
            const isPastDue = (classDate < today) || (currentFilter === 'past');

            const qrState = getQrCodeButtonState(item);

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
                            <span class="card-coach"><i class="fas fa-users"></i> Slots: ${item.slots_remaining}/${item.capacity}</span>
                            <span class="card-venue"><i class="fas fa-map-marker-alt"></i> ${item.venue_name || 'Main Studio'}</span>
                        </div>
                    </div>

                    <button class="btn-calendar" data-class-info='${encodeURIComponent(JSON.stringify(item))}' ${isPastDue ? 'disabled' : ''}>
                        <i class="fas ${isPastDue ? 'fa-calendar-xmark' : 'fa-calendar-plus'}"></i> ${isPastDue ? 'Past Due' : 'Add to Calendar'}
                    </button>

                    <button class="btn-attendance ${qrState.modeClass}" data-class-id="${item.id}" data-qr-type="${qrState.type}" ${qrState.disabled ? 'disabled' : ''}>
                        <i class="fas fa-qrcode"></i> <span class="attendance-btn-text">${qrState.text}</span>
                    </button>
                </div>
            `;

            // Calendar Download Action
            const calendarBtn = card.querySelector('.btn-calendar');
            if (calendarBtn && !isPastDue) {
                calendarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const classData = JSON.parse(decodeURIComponent(e.currentTarget.dataset.classInfo));
                    downloadICSFile(classData);
                });
            }

            const attendanceBtn = card.querySelector('.btn-attendance');
            if (attendanceBtn && !qrState.disabled) {
                attendanceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openQrModal(item, qrState.type);
                });
            }

            // Double click on slots to trigger Attendee & Override Modal with Strict Time/Date Check
            const slotsElement = card.querySelector('.card-coach');
                if (slotsElement) {
                    const handleModalTrigger = (e) => {
                        e.stopPropagation();
                        openAttendeeOverrideModal(item);
                    };

                    // Desktop double-click
                    slotsElement.addEventListener('dblclick', handleModalTrigger);

                    // Mobile double-tap tracking (detects two taps within 300ms)
                    let lastTapTime = 0;
                    slotsElement.addEventListener('touchend', (e) => {
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - lastTapTime;
                        if (tapLength < 300 && tapLength > 0) {
                            e.preventDefault();
                            handleModalTrigger(e);
                        }
                        lastTapTime = currentTime;
                    }, { passive: false });
                }

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

    function openQrModal(item, qrType) {
        qrDisplayModal.style.display = 'flex';
        qrcodeContainer.innerHTML = '';

        const isTimeout = qrType === 'time_out';
        qrModalTitle.innerHTML = `<i class="fas fa-qrcode"></i> ${isTimeout ? 'Time-Out' : 'Time-In'} QR Code`;
        qrClassDetails.textContent = `${item.title} (${formatTime(item.start_time)} - ${formatTime(item.end_time)})`;

        const qrPayload = JSON.stringify({
            class_id: item.id,
            title: item.title,
            type: qrType,
            date: item.schedule_date,
            timestamp: Date.now()
        });

        qrInstance = new QRCode(qrcodeContainer, {
            text: qrPayload,
            width: 220,
            height: 220,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    function closeQrDisplayModal() {
        qrDisplayModal.style.display = 'none';
        qrcodeContainer.innerHTML = '';
    }

    if (closeQrModal) closeQrModal.addEventListener('click', closeQrDisplayModal);
    if (doneQrBtn) doneQrBtn.addEventListener('click', closeQrDisplayModal);
    window.addEventListener('click', (e) => { if (e.target === qrDisplayModal) closeQrDisplayModal(); });

    // --- 3D Carousel Physics Math & Touch/Drag ---
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
            } else {
                card.classList.remove('card-active');
            }
        });

        if (currentIndexDisplay) currentIndexDisplay.textContent = Math.round(vIndex) + 1;
    }

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
            let vIndex = dragStartIndex - (dragOffset / maxOffset);
            
            if (vIndex < 0) vIndex *= 0.3; 
            if (vIndex > currentFilteredClasses.length - 1) {
                const overflow = vIndex - (currentFilteredClasses.length - 1);
                vIndex = (currentFilteredClasses.length - 1) + overflow * 0.3;
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

            finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredClasses.length - 1));
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
        let vIndex = dragStartIndex - (dragOffset / maxOffset);
        
        if (vIndex < 0) vIndex *= 0.3; 
        if (vIndex > currentFilteredClasses.length - 1) {
            const overflow = vIndex - (currentFilteredClasses.length - 1);
            vIndex = (currentFilteredClasses.length - 1) + overflow * 0.3;
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

        finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredClasses.length - 1));
        currentIndex = finalIndex;
        updateCardPositions(currentIndex, true);
    });

    function openAttendeeOverrideModal(item) {
        activeClassForOverride = item;
        attendeeOverrideModal.style.display = 'flex';
        attendeeModalSubtitle.textContent = `${item.title} (${formatTime(item.start_time)} - ${formatTime(item.end_time)})`;
        fetchClassAttendees(item.id);
    }

    function closeAttendeeOverrideModal() {
        attendeeOverrideModal.style.display = 'none';
        attendeeListContainer.innerHTML = '';
        activeClassForOverride = null;
    }

    if (closeAttendeeModal) closeAttendeeModal.addEventListener('click', closeAttendeeOverrideModal);
    window.addEventListener('click', (e) => { if (e.target === attendeeOverrideModal) closeAttendeeOverrideModal(); });

    async function fetchClassAttendees(classId) {
        try {
            attendeeListContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading attendees...</p>';
            const res = await fetch(`/api/classes/${classId}/attendees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch attendees.');
            const attendees = await res.json();
            renderAttendeeList(attendees);
        } catch (err) {
            console.error('Error fetching attendees:', err);
            attendeeListContainer.innerHTML = '<p style="color: #f87171; text-align: center;">Failed to load attendees.</p>';
        }
    }

    function renderAttendeeList(attendees) {
        attendeeListContainer.innerHTML = '';

        if (attendees.length === 0) {
            attendeeListContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No confirmed attendees found for this class.</p>';
            return;
        }

        attendees.forEach(att => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'attendee-item';
            itemDiv.dataset.userId = att.user_id;

            let statusText = 'Not Arrived';
            let statusClass = 'badge-none';
            if (att.time_out) {
                statusText = 'Completed';
                statusClass = 'badge-completed';
            } else if (att.time_in) {
                statusText = 'Timed-In';
                statusClass = 'badge-timed-in';
            }

            const avatarImg = att.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
            const phoneNum = att.phone || att.phone_number || '';

            itemDiv.innerHTML = `
                <div class="attendee-info-row">
                    <div class="attendee-profile">
                        <img src="${avatarImg}" alt="${att.name}" class="attendee-avatar">
                        <div>
                            <h4 class="attendee-name">${att.name}</h4>
                            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${att.email}</span>
                            ${phoneNum ? `<span class="attendee-phone-link" data-phone="${phoneNum}"><i class="fas fa-phone"></i> ${phoneNum}</span>` : `<span style="font-size: 0.7rem; color: #6b7280; display: block; margin-top: 2px;">No phone number</span>`}
                        </div>
                    </div>
                    <div>
                        <span class="attendee-status-badge ${statusClass}">${statusText}</span>
                        ${att.is_overridden ? `<span class="attendee-status-badge badge-overridden" title="Overridden by: ${att.overridden_by_name || 'Staff'}\nReason: ${att.override_reason || 'No reason provided'}">Overridden</span>` : ''}                    </div>
                </div>
                <div class="attendee-actions">
                    <button class="btn-edit-override" data-user-id="${att.user_id}">
                        <i class="fas fa-pen-to-square"></i> Override Status
                    </button>
                </div>
                <div class="override-form-wrapper" style="display: none;"></div>
            `;

            // Clickable phone number action
            const phoneLink = itemDiv.querySelector('.attendee-phone-link');
            if (phoneLink && phoneNum) {
                phoneLink.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    // Uses the project's confirmation modal to ask Call (Confirm) or Copy (Cancel) with custom button labels
                    const wantsCall = typeof window.showConfirmModal === 'function'
                        ? await window.showConfirmModal(`Choose an action for phone number: ${phoneNum}`, 'Phone Options', 'Call', 'Copy')
                        : confirm(`Call ${phoneNum}?\nClick Cancel to Copy instead.`);

                    if (wantsCall) {
                        // Navigate to phone call handler
                        window.location.href = `tel:${phoneNum}`;
                    } else {
                        // Robust copy approach with textarea fallback for all browsers/contexts
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(phoneNum);
                            } else {
                                const textarea = document.createElement('textarea');
                                textarea.value = phoneNum;
                                textarea.style.position = 'fixed'; // Prevents page scrolling
                                document.body.appendChild(textarea);
                                textarea.focus();
                                textarea.select();
                                const successful = document.execCommand('copy');
                                document.body.removeChild(textarea);
                                if (!successful) throw new Error('Fallback copy failed.');
                            }

                            if (typeof window.showSuccessModal === 'function') {
                                window.showSuccessModal(`Phone number ${phoneNum} copied to clipboard!`, 'Copied to Clipboard');
                            } else {
                                alert(`Copied to clipboard: ${phoneNum}`);
                            }
                        } catch (err) {
                            console.error('Failed to copy text: ', err);
                            if (typeof window.showErrorModal === 'function') {
                                window.showErrorModal('Failed to copy phone number to clipboard.', 'Copy Error');
                            } else {
                                alert('Failed to copy phone number.');
                            }
                        }
                    }
                });
            }

            const editBtn = itemDiv.querySelector('.btn-edit-override');
            const formWrapper = itemDiv.querySelector('.override-form-wrapper');

            editBtn.addEventListener('click', () => {
                const targetClass = activeClassForOverride || item;

                // Check if current time is past the class end time before opening the override form
                if (!canPerformOverride(targetClass)) {
                    if (typeof window.showErrorModal === 'function') {
                        window.showErrorModal('Attendance overrides are only available after the class end time.', 'Override Restricted');
                    } else {
                        alert('Attendance overrides are only available after the class end time.');
                    }
                    return;
                }

                if (formWrapper.style.display === 'block') {
                    formWrapper.style.display = 'none';
                    formWrapper.innerHTML = '';
                } else {
                    document.querySelectorAll('.override-form-wrapper').forEach(w => { w.style.display = 'none'; w.innerHTML = ''; });
                    
                    formWrapper.style.display = 'block';
                    formWrapper.innerHTML = `
                        <div class="override-form-container">
                            <label style="font-size: 0.8rem; font-weight: 600; color: #10b981;">Select New Status:</label>
                            <select class="override-status-select">
                                <option value="none" ${!att.time_in && !att.time_out ? 'selected' : ''}>Not Arrived (Clear Attendance)</option>
                                <option value="time_in" ${att.time_in && !att.time_out ? 'selected' : ''}>Time-In (Class Start Time)</option>
                                <option value="completed" ${att.time_out ? 'selected' : ''}>Completed / Time-Out (Class End Time)</option>
                            </select>
                            <label style="font-size: 0.8rem; font-weight: 600; color: #10b981; margin-top: 4px;">Override Reason (Required):</label>
                            <input type="text" class="override-reason-input" placeholder="e.g. Phone died, forgot to scan out" value="${att.override_reason || ''}">
                            <div class="override-form-buttons">
                                <button class="btn btn-secondary cancel-override-btn" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">Cancel</button>
                                <button class="btn btn-primary submit-override-btn" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">Save Override</button>
                            </div>
                        </div>
                    `;

                    formWrapper.querySelector('.submit-override-btn').addEventListener('click', async () => {
                        const newStatus = formWrapper.querySelector('.override-status-select').value;
                        const reason = formWrapper.querySelector('.override-reason-input').value.trim();

                        if (!reason) {
                            if (typeof window.showErrorModal === 'function') {
                                window.showErrorModal('Please provide a mandatory override reason.', 'Validation Error');
                            } else {
                                alert('Please provide a mandatory override reason.');
                            }
                            return;
                        }

                        // Show loading modal to prevent double-clicking and multiple requests
                        const loadingModal = document.getElementById('loadingModal');
                        if (loadingModal) loadingModal.style.display = 'flex';

                        try {
                            const res = await fetch('/api/attendance/override', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    class_id: targetClass.id,
                                    student_id: att.user_id,
                                    attendance_status: newStatus,
                                    override_reason: reason
                                })
                            });

                            const data = await res.json();
                            
                            // Hide loading modal before showing success modal
                            if (loadingModal) loadingModal.style.display = 'none';

                            if (!res.ok) throw new Error(data.message || 'Failed to submit override.');

                            if (typeof window.showSuccessModal === 'function') {
                                window.showSuccessModal('Attendance successfully overridden and email notification sent!', 'Success');
                            } else {
                                alert('Attendance successfully overridden and email notification sent!');
                            }

                            fetchClassAttendees(targetClass.id);
                        } catch (err) {
                            // Hide loading modal on error as well
                            if (loadingModal) loadingModal.style.display = 'none';
                            console.error('Override error:', err);
                            
                            if (typeof window.showErrorModal === 'function') {
                                window.showErrorModal(err.message || 'Failed to process attendance override.', 'Override Error');
                            } else {
                                alert(err.message || 'Failed to process attendance override.');
                            }
                        }
                    });
                }
            });

            attendeeListContainer.appendChild(itemDiv);
        });
    }

    loadFilterOptions();
    fetchCoachSchedule();
});