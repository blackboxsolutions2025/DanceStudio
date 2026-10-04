document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Shared Header into Placeholder
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        // Assuming standard fetch or header script injection. 
        // If header.js manages its own container injection, ensure it targets this element or the DOM.
    }

    // 2. Instructor Data & Modal Functionality
    const instructorData = {
        mike: {
            name: "Mike Alvarez",
            role: "Hip Hop & Street Jazz Specialist",
            bio: "Mike has been dancing and choreographing for over 10 years, having backed up major international artists and won national hip-hop titles. His classes focus on groove, musicality, and high-energy performance stamina.",
            classes: ["Urban Groove & Choreography", "Beginner Hip Hop Foundations", "Advanced Crew Training"]
        },
        sarah: {
            name: "Sarah Jenkins",
            role: "Contemporary & Lyrical Lead",
            bio: "Trained classically in ballet and modern dance, Sarah brings emotional depth and technical fluidity to her lyrical classes. She encourages dancers to express vulnerability and master core control.",
            classes: ["Lyrical Flow & Expression", "Contemporary Floorwork", "Ballet Technique for Dancers"]
        },
        chloe: {
            name: "Chloe Vance",
            role: "Commercial Heels Instructor",
            bio: "Chloe is a renowned commercial dancer and heels choreographer. Her classes empower students to build poise, self-confidence, balance, and sharp choreography in heels.",
            classes: ["High Heels Technique", "Commercial Video Vixen Choreo"]
        }
    };

    const modal = document.getElementById('instructorModal');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.querySelector('.close-modal');
    const instructorCards = document.querySelectorAll('.instructor-card');

    instructorCards.forEach(card => {
        card.addEventListener('click', () => {
            const instructorKey = card.getAttribute('data-instructor');
            const data = instructorData[instructorKey];

            if (data) {
                modalBody.innerHTML = `
                    <div class="modal-instructor-details">
                        <h3>${data.name}</h3>
                        <span class="role">${data.role}</span>
                        <p>${data.bio}</p>
                        <div class="modal-classes-list">
                            <h5>Classes Taught:</h5>
                            <ul>
                                ${data.classes.map(c => `<li>${c}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                modal.style.display = 'flex';
            }
        });
    });

    // Close Modal Events
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 3. Contact Form Submission Handler
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            alert(`Thank you, ${name}! Your message has been sent successfully. We will get back to you within 24 hours.`);
            contactForm.reset();
        });
    }

    // 4. Newsletter Form Submission Handler
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Thank you for subscribing to Rhythm & Soul!');
            newsletterForm.reset();
        });
    }
});