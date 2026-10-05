document.addEventListener('DOMContentLoaded', () => {
    let allClasses = [];
    let currentFilteredClasses = [];
    let currentIndex = 0;
    let cardElements = []; 

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
    
    const scheduleTrack = document.getElementById('scheduleTrack');
    const noClassesMessage = document.getElementById('noClassesMessage');
    const carouselCounter = document.getElementById('carouselCounter');
    const currentIndexDisplay = document.getElementById('currentIndexDisplay');
    const totalClassesDisplay = document.getElementById('totalClassesDisplay');

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

    // --- Data Fetching ---
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

    async function fetchClasses() {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch('/api/classes', { headers });
            
            if (response.ok) {
                allClasses = await response.json();
            } else {
                allClasses = getSampleClasses();
            }
            applyFilters();
        } catch (err) {
            console.warn('Using sample schedule data due to network state:', err);
            allClasses = getSampleClasses();
            applyFilters();
        }
    }

    function getSampleClasses() {
        return [{
            id: 1, title: 'RALPH: ALON SESSIONS', genreid: 1, genre_name: 'OPEN CHOREOGRAPHY',
            coachid: 1, coach_name: 'Ralph', venueid: 1, venue_name: 'Studio A',
            coach_class_image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
            schedule_date: '2026-10-03', start_time: '15:15:00', end_time: '17:00:00',
            slots_remaining: 3, capacity: 20, price: 500.00
        }];
    }

    function formatTime(timeStr) {
        const [hour, minute] = timeStr.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${minute} ${ampm}`;
    }

    function getCardDateParts(dateStr) {
        const d = new Date(dateStr);
        return { month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: d.getDate() };
    }

    // --- Pre-load All Filtered Cards into DOM ---
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

        if (currentIndex >= classesToRender.length) currentIndex = 0;

        classesToRender.forEach((cls, idx) => {
            const { month, day } = getCardDateParts(cls.schedule_date);
            const classImage = cls.coach_class_image || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600';
            const imagePosition = cls.coach_image_position || '50% 50%';
            const isBooked = cls.is_booked; // Evaluated from API

            const card = document.createElement('div');
            card.className = `class-card-custom ${isBooked ? 'card-booked' : ''}`;
            card.dataset.index = idx;

            card.innerHTML = `
                <div class="card-image-container">
                    <img src="${classImage}" alt="${cls.title}" class="card-bg-img" style="object-position: ${imagePosition};" draggable="false">
                    <div class="card-gradient-overlay"></div>
                    <div class="card-genre-badge">
                        <span>${cls.genre_name || 'DANCE CLASS'}</span>
                    </div>
                    <div class="card-date-badge">
                        <span class="date-month">${month}</span>
                        <span class="date-day">${day}</span>
                    </div>
                </div>
                <div class="card-content-area">
                    <h3 class="card-title" title="${cls.title}">${cls.title}</h3>
                    
                    <div class="card-time-pill">
                        <i class="fas fa-clock"></i> ${formatTime(cls.start_time)} - ${formatTime(cls.end_time)}
                    </div>

                    <div class="card-footer-info">
                        <div class="card-instructor-venue">
                            <span class="card-coach"><i class="fas fa-chalkboard-teacher"></i> Coach ${cls.coach_name || 'Instructor'}</span>
                            <span class="card-venue"><i class="fas fa-map-marker-alt"></i> ${cls.venue_name || 'Main Studio'}</span>
                        </div>
                        <span class="card-price">₱${parseFloat(cls.price).toLocaleString()}</span>
                    </div>

                    <button class="btn ${isBooked ? 'btn-booked-state' : 'btn-register register-btn'}" data-id="${cls.id}" ${isBooked ? 'disabled' : ''}>
                        ${isBooked ? 'BOOKED' : 'REGISTER NOW'}
                    </button>
                </div>
            `;

            // Handle Register Button Navigation only if not booked
            if (!isBooked) {
                const registerBtn = card.querySelector('.register-btn');
                if (registerBtn) {
                    registerBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent carousel card selection trigger
                        window.location.href = `../ClassCheckoutPage/ClassCheckoutPage.html?classId=${cls.id}`;
                    });
                }
            }

            // Navigation via card clicks
            card.addEventListener('click', (e) => {
                if (e.target.closest('.register-btn')) return;
                const clickedIdx = parseInt(card.dataset.index, 10);
                if (clickedIdx !== currentIndex) {
                    currentIndex = clickedIdx;
                    updateCardPositions(currentIndex, true); // Animates and shifts the clicked sub-card to the main position
                }
            });

            scheduleTrack.appendChild(card);
            cardElements.push(card);
        });

        updateCardPositions(currentIndex, false);
    }

    // --- Dynamic Card Physics Math (Enables infinite pre-loaded stack depth) ---
    function updateCardPositions(vIndex, animate = false) {
        const isMobile = window.innerWidth <= 768;
        const spacing = isMobile ? 75 : 88;          // Dynamic horizontal spacing %
        const scaleDropoff = isMobile ? 0.1 : 0.14;  // Scale decrease per depth layer
        const rotationBase = isMobile ? 5 : 10;      // Rotation strength

        cardElements.forEach((card, idx) => {
            const d = idx - vIndex;        // Distance relative to focus point
            const absD = Math.abs(d);      // Absolute distance from focus point
            
            // Native transition handling
            card.style.transition = animate 
                ? 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease, filter 0.5s ease' 
                : 'none';
            
            // Calculate spatial coordinates 
            const scale = Math.max(0.4, 1 - (absD * scaleDropoff));
            const rotateY = -d * rotationBase; 
            const translateX = d * spacing;
            
            // Falloff logic
            const opacity = absD === 0 ? 1 : Math.max(0.1, 1 - (absD * 0.3));
            const blurAmount = Math.min(6, absD * 1.5);
            const zIndex = 100 - Math.round(absD * 10);
            
            // Apply inline layout physics natively
            card.style.transform = `translateX(${translateX}%) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity = opacity;
            card.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';
            card.style.zIndex = zIndex;
            
            // Allow interactions only for nearby visible cards
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

    // --- Touch & Drag Navigation System (Continuous multi-card skip handling) ---
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let dragStartIndex = 0;

    if (scheduleTrack) {
        scheduleTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isDragging = true;
            dragStartIndex = currentIndex; // Capture origin of drag
        }, { passive: true });

        scheduleTrack.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const dragOffset = currentX - startX;
            
            // Map drag distance into 'virtual card index' progression
            const maxOffset = window.innerWidth <= 768 ? 200 : 300; 
            const indexShift = -dragOffset / maxOffset;
            let vIndex = dragStartIndex + indexShift;
            
            // Dampen drag at boundaries instead of hard clipping
            if (vIndex < 0) vIndex *= 0.3; 
            if (vIndex > currentFilteredClasses.length - 1) {
                const overflow = vIndex - (currentFilteredClasses.length - 1);
                vIndex = (currentFilteredClasses.length - 1) + overflow * 0.3;
            }

            // Real-time track without smooth transition css interference
            updateCardPositions(vIndex, false);
        }, { passive: true });

        scheduleTrack.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const dragOffset = currentX - startX;
            const maxOffset = window.innerWidth <= 768 ? 200 : 300;
            const indexShift = -dragOffset / maxOffset;
            
            // Round drag completion to nearest whole card
            let finalIndex = Math.round(dragStartIndex + indexShift);

            // Give a quick flick detection boost for fast, short swipes
            if (Math.abs(indexShift) < 0.5 && Math.abs(dragOffset) > 40) {
               finalIndex = dragOffset < 0 ? dragStartIndex + 1 : dragStartIndex - 1;
            }

            // Secure boundaries
            finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredClasses.length - 1));
            
            currentIndex = finalIndex;
            updateCardPositions(currentIndex, true); // Snap into final place
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

        if (Math.abs(indexShift) < 0.5 && Math.abs(dragOffset) > 40) {
            finalIndex = dragOffset < 0 ? dragStartIndex + 1 : dragStartIndex - 1;
        }
        finalIndex = Math.max(0, Math.min(finalIndex, currentFilteredClasses.length - 1));
        
        currentIndex = finalIndex;
        updateCardPositions(currentIndex, true);
    });

    // --- Filtering Logic ---
    function updateSummaryCardDisplay(rangeMode, genreText, coachText, venueText) {
        let rangeLabel = "All Upcoming";
        if (rangeMode === 'today') rangeLabel = "This Day";
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
            rangeMode === 'all' && 
            (!filterGenre || filterGenre.value === '') && 
            (!filterCoach || filterCoach.value === '') &&
            (!filterVenue || filterVenue.value === '')
        );
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';
    }

    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'all';
        const selectedGenre = filterGenre ? filterGenre.value : '';
        const selectedCoach = filterCoach ? filterCoach.value : '';
        const selectedVenue = filterVenue ? filterVenue.value : '';

        const genreLabel = filterGenre && selectedGenre ? filterGenre.options[filterGenre.selectedIndex].text : "All Genres";
        const coachLabel = filterCoach && selectedCoach ? filterCoach.options[filterCoach.selectedIndex].text : "All Coaches";
        const venueLabel = filterVenue && selectedVenue ? filterVenue.options[filterVenue.selectedIndex].text : "All Venues";

        updateSummaryCardDisplay(rangeMode, genreLabel, coachLabel, venueLabel);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const filtered = allClasses.filter(cls => {
            const clsDate = new Date(cls.schedule_date);
            clsDate.setHours(0, 0, 0, 0);

            let matchDate = true;

            if (rangeMode === 'today') {
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

            const matchGenre = !selectedGenre || String(cls.genreid) === String(selectedGenre);
            const matchCoach = !selectedCoach || String(cls.coachid) === String(selectedCoach);
            const matchVenue = !selectedVenue || String(cls.venueid) === String(selectedVenue);
            
            return matchDate && matchGenre && matchCoach && matchVenue;
        });

        renderCarousel(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterDateRangeMode) filterDateRangeMode.value = 'all';
            if (customDateContainer) customDateContainer.style.display = 'none';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            if (filterGenre) filterGenre.value = '';
            if (filterCoach) filterCoach.value = '';
            if (filterVenue) filterVenue.value = '';
            applyFilters();
        });
    }

    loadFilterOptions();
    fetchClasses();
});