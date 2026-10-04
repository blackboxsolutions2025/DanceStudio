document.addEventListener('DOMContentLoaded', () => {
    let allClasses = [];
    let currentFilteredClasses = [];
    let currentIndex = 0;

    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryDate = document.getElementById('summaryDate');
    const summaryGenre = document.getElementById('summaryGenre');
    const summaryCoach = document.getElementById('summaryCoach');

    const filterDateRangeMode = document.getElementById('filterDateRangeMode');
    const customDateContainer = document.getElementById('customDateContainer');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterGenre = document.getElementById('filterGenre');
    const filterCoach = document.getElementById('filterCoach');
    
    const scheduleTrack = document.getElementById('scheduleTrack');
    const noClassesMessage = document.getElementById('noClassesMessage');
    const carouselCounter = document.getElementById('carouselCounter');
    const currentIndexDisplay = document.getElementById('currentIndexDisplay');
    const totalClassesDisplay = document.getElementById('totalClassesDisplay');

    // --- Modal Open/Close Event Listeners ---
    if (openFilterModal) {
        openFilterModal.addEventListener('click', () => {
            filterModal.style.display = 'flex';
        });
    }

    if (closeFilterModal) {
        closeFilterModal.addEventListener('click', () => {
            filterModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === filterModal) {
            filterModal.style.display = 'none';
        }
    });

    if (filterDateRangeMode) {
        filterDateRangeMode.addEventListener('change', () => {
            if (filterDateRangeMode.value === 'custom') {
                customDateContainer.style.display = 'flex';
                if (!filterStartDate.value) {
                    filterStartDate.value = new Date().toISOString().split('T')[0];
                }
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
            const [genreRes, coachRes] = await Promise.all([
                fetch('/api/genres'),
                fetch('/api/coaches')
            ]);

            if (genreRes.ok && filterGenre) {
                const genres = await genreRes.json();
                genres.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    filterGenre.appendChild(opt);
                });
            }

            if (coachRes.ok && filterCoach) {
                const coaches = await coachRes.json();
                coaches.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    filterCoach.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not load dynamic filter options from server:', err);
        }
    }

    async function fetchClasses() {
        try {
            const response = await fetch('/api/classes');
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
        return [
            {
                id: 1,
                title: 'RALPH: ALON SESSIONS',
                genreid: 1,
                genre_name: 'OPEN CHOREOGRAPHY',
                coachid: 1,
                coach_name: 'Ralph',
                coach_class_image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
                schedule_date: '2026-10-03',
                start_time: '15:15:00',
                end_time: '17:00:00',
                slots_remaining: 3,
                capacity: 20,
                price: 500.00
            }
        ];
    }

    function formatTime(timeStr) {
        const [hour, minute] = timeStr.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    }

    function getCardDateParts(dateStr) {
        const d = new Date(dateStr);
        const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = d.getDate();
        return { month, day };
    }

    // --- Carousel Rendering & Empty View Handling ---
    function renderCarousel(classesToRender) {
        currentFilteredClasses = classesToRender;
        if (!scheduleTrack) return;
        scheduleTrack.innerHTML = '';

        if (classesToRender.length === 0) {
            if (noClassesMessage) noClassesMessage.style.display = 'block';
            if (carouselCounter) carouselCounter.style.display = 'none';
            return;
        }

        if (noClassesMessage) noClassesMessage.style.display = 'none';
        if (carouselCounter) carouselCounter.style.display = 'block';
        if (totalClassesDisplay) totalClassesDisplay.textContent = classesToRender.length;

        if (currentIndex >= classesToRender.length) {
            currentIndex = 0;
        }

        if (currentIndexDisplay) currentIndexDisplay.textContent = currentIndex + 1;

        classesToRender.forEach((cls, idx) => {
            const { month, day } = getCardDateParts(cls.schedule_date);
            const classImage = cls.coach_class_image || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600';

            const card = document.createElement('div');
            card.className = 'class-card-custom';
            
            if (idx === currentIndex) {
                card.classList.add('card-active');
            } else if (idx === currentIndex - 1) {
                card.classList.add('card-prev');
            } else if (idx === currentIndex + 1) {
                card.classList.add('card-next');
            } else if (idx < currentIndex) {
                card.classList.add('card-far-left');
            } else {
                card.classList.add('card-far-right');
            }

            card.innerHTML = `
                <div class="card-image-container">
                    <img src="${classImage}" alt="${cls.title}" class="card-bg-img" draggable="false">
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
                    <h3 class="card-title">${cls.title}</h3>
                    
                    <div class="card-time-pill">
                        <i class="fas fa-clock"></i> ${formatTime(cls.start_time)} - ${formatTime(cls.end_time)}
                    </div>

                    <div class="card-footer-info">
                        <span class="card-coach"><i class="fas fa-chalkboard-teacher"></i> Coach ${cls.coach_name || 'Instructor'}</span>
                        <span class="card-price">₱${parseFloat(cls.price).toLocaleString()}</span>
                    </div>

                    <button class="btn btn-register register-btn" data-id="${cls.id}">
                        REGISTER NOW
                    </button>
                </div>
            `;

            // --- Click/Tap Handler for Sub-Cards ---
            card.addEventListener('click', (e) => {
                // Ignore clicks originating from the register button directly
                if (e.target.closest('.register-btn')) return;

                if (card.classList.contains('card-prev')) {
                    animateTransitionToCard('prev', classesToRender);
                } else if (card.classList.contains('card-next')) {
                    animateTransitionToCard('next', classesToRender);
                }
            });

            card.querySelector('.register-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = `../ClassDetails/ClassDetails.html?id=${cls.id}`;
            });

            scheduleTrack.appendChild(card);
        });
    }

    // --- Touch & Mouse Real-Time Dragging ---
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const swipeThreshold = 40;

    function updateCardDragProgress(trackElement, dragOffset, maxOffset = 300) {
        if (!trackElement) return;
        const cards = trackElement.querySelectorAll('.class-card-custom');
        const progress = Math.max(-1, Math.min(1, dragOffset / maxOffset));
        
        // Match mobile vs desktop peeking percentage
        const isMobile = window.innerWidth <= 768;
        const peekPercent = isMobile ? 76 : 88;
        
        cards.forEach((card) => {
            card.style.transition = 'none';

            if (card.classList.contains('card-active')) {
                const currentScale = 1 - (Math.abs(progress) * 0.15);
                const currentOpacity = 1 - (Math.abs(progress) * 0.2);
                card.style.transform = `translateX(${dragOffset}px) scale(${currentScale})`;
                card.style.opacity = currentOpacity;
            } 
            else if (card.classList.contains('card-prev')) {
                const currentScale = 0.85 + (Math.max(0, progress) * 0.15);
                const currentOpacity = 0.45 + (Math.max(0, progress) * 0.55);
                card.style.transform = `translateX(calc(-${peekPercent}% + ${dragOffset}px)) scale(${currentScale}) rotateY(${5 - (Math.max(0, progress) * 5)}deg)`;
                card.style.opacity = currentOpacity;
            } 
            else if (card.classList.contains('card-next')) {
                const currentScale = 0.85 + (Math.max(0, -progress) * 0.15);
                const currentOpacity = 0.45 + (Math.max(0, -progress) * 0.55);
                card.style.transform = `translateX(calc(${peekPercent}% + ${dragOffset}px)) scale(${currentScale}) rotateY(${-5 + (Math.max(0, -progress) * 5)}deg)`;
                card.style.opacity = currentOpacity;
            }
        });
    }

    function resetCardStyles(trackElement) {
        if (!trackElement) return;
        const cards = trackElement.querySelectorAll('.class-card-custom');
        cards.forEach((card) => {
            card.style.transition = '';
            card.style.transform = '';
            card.style.opacity = '';
        });
    }

    if (scheduleTrack) {
        scheduleTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isDragging = true;
        }, { passive: true });

        scheduleTrack.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const dragOffset = currentX - startX;
            updateCardDragProgress(scheduleTrack, dragOffset);
        }, { passive: true });

        scheduleTrack.addEventListener('touchend', () => {
            if (!isDragging) return;
            resetCardStyles(scheduleTrack);
            handleSwipeGesture();
            isDragging = false;
        });

        scheduleTrack.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            currentX = startX;
            isDragging = true;
            e.preventDefault();
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
        const dragOffset = currentX - startX;
        updateCardDragProgress(scheduleTrack, dragOffset);
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        resetCardStyles(scheduleTrack);
        handleSwipeGesture();
        isDragging = false;
    });

    function handleSwipeGesture() {
        if (!currentX) return;
        const diff = startX - currentX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0 && currentIndex < currentFilteredClasses.length - 1) {
                currentIndex++;
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
            }
            renderCarousel(currentFilteredClasses);
        }
        currentX = 0;
    }

    // --- Filtering & Summary Logic ---
    function updateSummaryCardDisplay(rangeMode, genreText, coachText) {
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
        
        const isDefault = (rangeMode === 'all' && (!filterGenre || filterGenre.value === '') && (!filterCoach || filterCoach.value === ''));
        if (activeFiltersBadge) {
            activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';
        }
    }

    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'all';
        const selectedGenre = filterGenre ? filterGenre.value : '';
        const selectedCoach = filterCoach ? filterCoach.value : '';

        const genreLabel = filterGenre && selectedGenre ? filterGenre.options[filterGenre.selectedIndex].text : "All Genres";
        const coachLabel = filterCoach && selectedCoach ? filterCoach.options[filterCoach.selectedIndex].text : "All Coaches";

        updateSummaryCardDisplay(rangeMode, genreLabel, coachLabel);

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
            
            return matchDate && matchGenre && matchCoach;
        });

        currentIndex = 0;
        renderCarousel(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) {
        applyModalFilters.addEventListener('click', applyFilters);
    }

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterDateRangeMode) filterDateRangeMode.value = 'all';
            if (customDateContainer) customDateContainer.style.display = 'none';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            if (filterGenre) filterGenre.value = '';
            if (filterCoach) filterCoach.value = '';
            applyFilters();
        });
    }

    loadFilterOptions();
    fetchClasses();

    // --- Smooth Click-to-Glide Transition (Mirrors Dragging Physics) ---
    function animateTransitionToCard(targetDirection, classesToRender) {
        const isMobile = window.innerWidth <= 768;
        
        // Reduce travel distance on mobile so it doesn't feel like a huge jump
        const targetOffset = targetDirection === 'prev' 
            ? (isMobile ? 150 : 300) 
            : (isMobile ? -150 : -300);
            
        let startTime = null;
        const duration = isMobile ? 220 : 350; // Quicker, smoother mobile duration

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth cubic ease-out curve
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentOffset = targetOffset * easeProgress;

            // Apply real-time card tracking with adjusted max offset reference
            updateCardDragProgress(scheduleTrack, currentOffset, Math.abs(targetOffset));

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                // Animation complete: update index and re-render fresh carousel state
                if (targetDirection === 'prev') {
                    currentIndex = (currentIndex - 1 + classesToRender.length) % classesToRender.length;
                } else {
                    currentIndex = (currentIndex + 1) % classesToRender.length;
                }
                resetCardStyles(scheduleTrack);
                renderCarousel(classesToRender);
            }
        }

        requestAnimationFrame(step);
    }
});