document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    const token = localStorage.getItem('token');

    const btnProceed = document.getElementById('btnProceedPayment');
    const modal = document.getElementById('confirmationModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const btnConfirmModal = document.getElementById('btnConfirmModal');

    if (!token) {
        alert("You must be logged in to enroll.");
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }
    if (!classId) {
        window.location.href = '../ClassSchedulePage/ClassSchedulePage.html';
        return;
    }

    // 1. Fetch Class Data
    try {
        const classRes = await fetch(`/api/classes/${classId}`);
        if (classRes.ok) {
            const classData = await classRes.json();
            document.getElementById('classSummaryLoading').classList.add('hidden');
            document.getElementById('classSummaryContent').classList.remove('hidden');
            
            document.getElementById('cTitle').textContent = classData.title;
            document.getElementById('cCoach').textContent = classData.coach_name;
            
            // Format date for display
            const dateObj = new Date(classData.schedule_date);
            document.getElementById('cDate').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            document.getElementById('cTime').textContent = `${classData.start_time} - ${classData.end_time}`;
            document.getElementById('cVenue').textContent = classData.venue_name;
            document.getElementById('cPrice').textContent = `₱${parseFloat(classData.price).toFixed(2)}`;
        }
    } catch (err) {
        console.error("Error fetching class details:", err);
    }

    // 2. Fetch User Profile (Leveraging existing API endpoint)
    try {
        const profileRes = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            document.getElementById('sName').textContent = profileData.name;
            document.getElementById('sEmail').textContent = profileData.email;
            document.getElementById('sPhone').textContent = profileData.phone;
        }
    } catch (err) {
        console.error("Error fetching user profile:", err);
    }

    // 3. Handle Payment Button Trigger
    btnProceed.addEventListener('click', async () => {
        try {
            const checkRes = await fetch(`/api/enrollments/check?class_id=${classId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.isBooked) {
                    window.showErrorModal(
                        'You are already confirmed and have an active paid enrollment for this class. Duplicate bookings are not allowed, please check your current schedule.', 
                        'Duplicate Booking'
                    );
                    return; // Stops execution, preventing the confirmation modal from opening
                }
            }
        } catch (err) {
            console.error("Error checking enrollment status:", err);
        }

        // If not booked/paid yet, proceed to show the confirmation modal
        modal.classList.remove('hidden');
    });

    btnCancelModal.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    btnConfirmModal.addEventListener('click', async () => {
        modal.classList.add('hidden');
        btnProceed.disabled = true;
        document.querySelector('.btn-text').textContent = 'Redirecting to PayMongo...';

        try {
            const checkoutRes = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ class_id: classId })
            });

            const data = await checkoutRes.json();
            
            if (checkoutRes.ok && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                alert(data.message || 'Error generating checkout link.');
                btnProceed.disabled = false;
                document.querySelector('.btn-text').textContent = 'Proceed to Payment';
            }
        } catch (err) {
            console.error("Payment trigger failed:", err);
            btnProceed.disabled = false;
            document.querySelector('.btn-text').textContent = 'Proceed to Payment';
        }
    });

    // Handle Cancel Checkout Button
    const btnCancelCheckout = document.getElementById('btnCancelCheckout');
    btnCancelCheckout.addEventListener('click', () => {
        window.location.href = '../ClassSchedulePage/ClassSchedulePage.html';
    });
});