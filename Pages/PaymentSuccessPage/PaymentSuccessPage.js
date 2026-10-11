document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');

    const successTitle = document.getElementById('successTitle');
    const successSubtitle = document.getElementById('successSubtitle');
    const nextStepText = document.getElementById('nextStepText');
    const primaryActionBtn = document.getElementById('primaryActionBtn');

    if (type === 'venue') {
        successTitle.textContent = 'Venue Rental Confirmed!';
        successSubtitle.textContent = 'Thank you for your payment. Your private venue rental has been successfully secured and confirmed.';
        nextStepText.textContent = 'Inspect your booked venue & get ready!';
        primaryActionBtn.href = '../VenueRentalPage/VenueRentalPage.html';
        primaryActionBtn.innerHTML = '<i class="fa-solid fa-building"></i> View Venue Rentals';
    } else if (type === 'shop') {
        successTitle.textContent = 'Order Confirmed!';
        successSubtitle.textContent = 'Thank you for your payment. Your shop order has been successfully placed and confirmed.';
        nextStepText.textContent = 'Check your email for confirmation details!';
        primaryActionBtn.href = '../ShopListPage/ShopListPage.html';
        primaryActionBtn.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> Continue Shopping';
    } else {
        // Default to class enrollment
        successTitle.textContent = 'Enrollment Confirmed!';
        successSubtitle.textContent = 'Thank you for your payment. Your spot in the dance class has been successfully secured.';
        nextStepText.textContent = 'Check your schedule & get ready to dance!';
        primaryActionBtn.href = '../ClassSchedulePage/ClassSchedulePage.html';
        primaryActionBtn.innerHTML = '<i class="fa-solid fa-calendar-alt"></i> View Class Schedule';
    }
});