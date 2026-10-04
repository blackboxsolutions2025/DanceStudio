document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Please log in to access your account settings.', 'Access Denied', () => {
                window.location.href = '../LoginPage/LoginPage.html';
            });
        } else {
            alert('Please log in first.');
            window.location.href = '../LoginPage/LoginPage.html';
        }
        return;
    }

    const profileForm = document.getElementById('profileForm');
    const profileNameInput = document.getElementById('profileName');
    const profilePhoneInput = document.getElementById('profilePhone');
    const profileEmailInput = document.getElementById('profileEmail');
    const profilePicInput = document.getElementById('profilePicInput');
    const avatarImg = document.getElementById('avatarImg');
    const avatarPlaceholderIcon = document.getElementById('avatarPlaceholderIcon');

    // Coach Card Image Elements
    const coachCardImageSection = document.getElementById('coachCardImageSection');
    const coachCardImageForm = document.getElementById('coachCardImageForm');
    const coachCardInput = document.getElementById('coachCardInput');
    const coachCardImg = document.getElementById('coachCardImg');
    const coachCardPlaceholder = document.getElementById('coachCardPlaceholder');
    const cardImageContainer = document.getElementById('cardImageContainer');
    const cardDragHint = document.getElementById('cardDragHint');

    // Image Positioning State (Percentages X and Y)
    let posX = 50;
    let posY = 50;

    // Helper to apply and update position
    const updateObjectPosition = (x, y) => {
        posX = Math.max(0, Math.min(100, x));
        posY = Math.max(0, Math.min(100, y));
        coachCardImg.style.objectPosition = `${posX}% ${posY}%`;
    };

    // 1. Load user profile data and coach class image & position
    const loadUserData = async () => {
        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load profile.');
            
            const user = await response.json();
            profileNameInput.value = user.name || '';
            profilePhoneInput.value = user.phone || '';
            profileEmailInput.value = user.email || '';

            if (user.profileImage) {
                avatarImg.src = user.profileImage;
                avatarImg.style.display = 'block';
                avatarPlaceholderIcon.style.display = 'none';
            }

            // If user role is coach, display the Card Profile Image section
            if (user.role === 'coach' && coachCardImageSection) {
                coachCardImageSection.style.display = 'block';
                if (user.coachClassImage) {
                    coachCardImg.src = user.coachClassImage;
                    coachCardImg.style.display = 'block';
                    if (coachCardPlaceholder) coachCardPlaceholder.style.display = 'none';
                    if (cardDragHint) cardDragHint.style.display = 'block';
                }
                if (user.imagePosition) {
                    const parts = user.imagePosition.split(' ');
                    if (parts.length === 2) {
                        posX = parseFloat(parts[0]) || 50;
                        posY = parseFloat(parts[1]) || 50;
                        coachCardImg.style.objectPosition = user.imagePosition;
                    }
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Could not retrieve your profile data from server.', 'Connection Error');
            }
        }
    };

    loadUserData();

    // 2. Profile picture live preview
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // Updated to 5MB
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal('Card image size must be less than 5MB.', 'File Too Large');
                } else {
                    alert('Image size must be less than 5MB.');
                }
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarImg.src = e.target.result;
                avatarImg.style.display = 'block';
                avatarPlaceholderIcon.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // 3. Coach Class Card Image live preview
    if (coachCardInput) {
        coachCardInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // Updated to 5MB
                    if (typeof window.showErrorModal === 'function') {
                        window.showErrorModal('Card image size must be less than 5MB.', 'File Too Large');
                    } else {
                        alert('Image size must be less than 5MB.');
                    }
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    coachCardImg.src = e.target.result;
                    coachCardImg.style.display = 'block';
                    if (coachCardPlaceholder) coachCardPlaceholder.style.display = 'none';
                    if (cardDragHint) cardDragHint.style.display = 'block';
                    updateObjectPosition(50, 50); // Reset to center on new upload
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. Interactive Drag-to-Reposition Logic on Card Image Preview
    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;

    const startDrag = (clientX, clientY) => {
        if (coachCardImg.style.display === 'none') return;
        isDragging = true;
        startMouseX = clientX;
        startMouseY = clientY;
    };

    const onDrag = (clientX, clientY) => {
        if (!isDragging) return;
        const deltaX = clientX - startMouseX;
        const deltaY = clientY - startMouseY;

        startMouseX = clientX;
        startMouseY = clientY;

        // Sensitivity factor to scale movement smoothly
        const sensitivity = 0.35;
        updateObjectPosition(posX - (deltaX * sensitivity), posY - (deltaY * sensitivity));
    };

    const stopDrag = () => {
        isDragging = false;
    };

    // Mouse Events
    cardImageContainer.addEventListener('mousedown', (e) => {
        startDrag(e.clientX, e.clientY);
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        onDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
        stopDrag();
    });

    // Touch Events for Mobile / Tablet support
    cardImageContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            onDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    });

    window.addEventListener('touchend', () => {
        stopDrag();
    });

    // 5. Submit Profile Form
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Profile...';

        const formData = new FormData();
        formData.append('name', profileNameInput.value.trim());
        formData.append('phone', profilePhoneInput.value.trim());

        if (profilePicInput.files[0]) {
            formData.append('profileImage', profilePicInput.files[0]);
        }

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('userName', profileNameInput.value.trim());
                if (result.profileImage) {
                    avatarImg.src = result.profileImage;
                }
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(result.message || 'Profile updated successfully!', 'Success');
                } else {
                    alert(result.message);
                }
            } else {
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal(result.message || 'Failed to update profile.', 'Error');
                } else {
                    alert(result.message);
                }
            }
        } catch (err) {
            console.error('Network error:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('A network error occurred while updating profile.', 'Connection Error');
            } else {
                alert('A network error occurred.');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });

    // 6. Submit Coach Card Image & Position Form
    if (coachCardImageForm) {
        coachCardImageForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = coachCardImageForm.querySelector('button[type="submit"]');
            const originalBtnHTML = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Card Image...';

            const formData = new FormData();
            if (coachCardInput.files[0]) {
                formData.append('classImage', coachCardInput.files[0]);
            }
            formData.append('imagePosition', `${Math.round(posX)}% ${Math.round(posY)}%`);

            try {
                const response = await fetch('/api/coach/class-image', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    if (result.coachClassImage) {
                        coachCardImg.src = result.coachClassImage;
                    }
                    if (typeof window.showSuccessModal === 'function') {
                        window.showSuccessModal(result.message || 'Class card profile image and position updated successfully!', 'Success');
                    } else {
                        alert(result.message);
                    }
                } else {
                    if (typeof window.showErrorModal === 'function') {
                        window.showErrorModal(result.message || 'Failed to update class card image.', 'Error');
                    } else {
                        alert(result.message);
                    }
                }
            } catch (err) {
                console.error('Network error:', err);
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal('A network error occurred while updating card image.', 'Connection Error');
                } else {
                    alert('A network error occurred.');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
        });
    }

    // 7. Security Form Logic
    const securityForm = document.getElementById('securityForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    securityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = currentPasswordInput.value;
        const newPass = newPasswordInput.value;
        const confirmPass = confirmPasswordInput.value;

        if (newPass !== confirmPass) {
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('New password and confirmation password do not match.', 'Password Mismatch');
            } else {
                alert('New passwords do not match.');
            }
            return;
        }

        if (newPass.length < 6) {
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Password must be at least 6 characters long.', 'Weak Password');
            } else {
                alert('Password must be at least 6 characters long.');
            }
            return;
        }

        const submitBtn = securityForm.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating Password...';

        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword: newPass })
            });

            const result = await response.json();

            if (response.ok) {
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(result.message || 'Your password has been changed securely.', 'Security Updated', () => {
                        securityForm.reset();
                    });
                } else {
                    alert('Password updated successfully!');
                    securityForm.reset();
                }
            } else {
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal(result.message || 'Failed to update password.', 'Security Error');
                } else {
                    alert('Error: ' + result.message);
                }
            }
        } catch (err) {
            console.error('Password update network error:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('A network error occurred while updating your password.', 'Connection Error');
            } else {
                alert('A network error occurred.');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
});