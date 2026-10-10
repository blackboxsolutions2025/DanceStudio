document.addEventListener('DOMContentLoaded', async () => {
    const venuesGrid = document.getElementById('venuesGrid');

    // Load Venues
    try {
        const res = await secureFetch('/api/venues');
        const venues = await res.json();
        
        venuesGrid.innerHTML = '';
        if (venues.length === 0) {
            venuesGrid.innerHTML = '<p class="empty-text">No venues currently available.</p>';
            return;
        }

        venues.forEach(venue => {
            const card = document.createElement('div');
            card.className = 'venue-card-custom';
            
            const mainImg = venue.image ? venue.image : 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80';
            const hourlyRate = venue.hourly_rate ? Number(venue.hourly_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '1,500.00';
            const mapLink = venue.location_link ? venue.location_link : '#';

            card.innerHTML = `
                <div class="card-image-container">
                    <img src="${mainImg}" alt="${venue.name}" class="card-bg-img" draggable="false">
                    <div class="card-gradient-overlay"></div>
                </div>
                <div class="card-content-area">
                    <h3 class="card-title" title="${venue.name}">${venue.name}</h3>
                    
                    <div class="card-footer-info">
                        <a href="${mapLink}" target="_blank" rel="noopener noreferrer" class="card-rate" style="text-decoration: none;">
                            <i class="fas fa-map-marker-alt"></i> View Map
                        </a>
                        <span class="card-price">₱${hourlyRate} / hr</span>
                    </div>

                    <a href="../VenueRentalBuilderPage/VenueRentalBuilderPage.html?venueId=${venue.id}" class="btn-register">
                        <i class="fa-solid fa-calendar-plus"></i> BOOK VENUE
                    </a>
                </div>
            `;
            venuesGrid.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load venues:', err);
    }
});