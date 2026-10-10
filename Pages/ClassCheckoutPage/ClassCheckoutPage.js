document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');

    const btnProceed = document.getElementById('btnProceedPayment');

    // 1. Fetch Class Data using secureFetch
    try {
        const classRes = await secureFetch(`/api/classes/${classId}`);
        if (classRes.ok) {
            const classData = await classRes.json();
            document.getElementById('classSummaryLoading').classList.add('hidden');
            document.getElementById('classSummaryContent').classList.remove('hidden');
            
            document.getElementById('cTitle').textContent = classData.title;
            document.getElementById('cCoach').textContent = classData.coach_name;
            
            const dateObj = new Date(classData.schedule_date);
            document.getElementById('cDate').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            document.getElementById('cTime').textContent = `${classData.start_time} - ${classData.end_time}`;
            document.getElementById('cVenue').textContent = classData.venue_name;
            document.getElementById('cPrice').textContent = `₱${parseFloat(classData.price).toFixed(2)}`;
        } else {
            throw new Error('Failed to load class details.');
        }
    } catch (err) {
        console.error("Error fetching class details:", err);
        window.showErrorModal(err.message || 'Could not load class information.', 'Error');
    }

    // 2. Fetch User Profile using secureFetch
    try {
        const profileRes = await secureFetch('/api/user/profile');
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            document.getElementById('sName').textContent = profileData.name;
            document.getElementById('sEmail').textContent = profileData.email;
            document.getElementById('sPhone').textContent = profileData.phone;
        }
    } catch (err) {
        console.error("Error fetching user profile:", err);
    }

    // 3. Handle Payment Button Trigger & Global Modals
    btnProceed.addEventListener('click', async () => {
        try {
            const checkRes = await secureFetch(`/api/enrollments/check?class_id=${classId}`);
            
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.isBooked) {
                    window.showErrorModal(
                        'You are already confirmed and have an active paid enrollment for this class. Duplicate bookings are not allowed, please check your current schedule.', 
                        'Duplicate Booking'
                    );
                    return; 
                }
            }
        } catch (err) {
            console.error("Error checking enrollment status:", err);
        }

        // Trigger global confirmation modal
        const confirmed = await window.showConfirmModal(
            'Please note that all class payments are non-refundable once processed. Would you like to continue to PayMongo?',
            'Confirm Enrollment Payment',
            'Proceed to Payment',
            'Cancel'
        );

        if (confirmed) {
            btnProceed.disabled = true;
            document.querySelector('.btn-text').textContent = 'Redirecting to PayMongo...';

            try {
                const checkoutRes = await secureFetch('/api/checkout', {
                    method: 'POST',
                    body: JSON.stringify({ class_id: classId })
                });

                const data = await checkoutRes.json();
                
                if (checkoutRes.ok && data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                } else {
                    window.showErrorModal(data.message || 'Error generating checkout link.', 'Payment Failed');
                    btnProceed.disabled = false;
                    document.querySelector('.btn-text').textContent = 'Proceed to Payment';
                }
            } catch (err) {
                console.error("Payment trigger failed:", err);
                window.showErrorModal('Network error while initiating checkout.', 'Error');
                btnProceed.disabled = false;
                document.querySelector('.btn-text').textContent = 'Proceed to Payment';
            }
        }
    });

    // Handle Cancel Checkout Button
    const btnCancelCheckout = document.getElementById('btnCancelCheckout');
    btnCancelCheckout.addEventListener('click', () => {
        window.location.href = '../ClassSchedulePage/ClassSchedulePage.html';
    });
});