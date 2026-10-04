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

    // 1. Load user profile data and global image from database
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
        } catch (err) {
            console.error('Error loading profile:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Could not retrieve your profile data from server.', 'Connection Error');
            }
        }
    };

    loadUserData();

    // 2. Preview image instantly when selected (with global error modal validation)
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal('Profile image size must be less than 2MB.', 'File Too Large');
                } else {
                    alert('Image size must be less than 2MB.');
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

    // 3. Submit profile changes with Loading Animation & Global Modals
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        
        // Activate Loading State
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
                headers: {
                    'Authorization': `Bearer ${token}`
                },
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
            // Restore Button State
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });

    // --- 4. Security Section Logic with Loading Animation & Global Modals ---
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

        // Activate Loading State
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
            // Restore Button State
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
});