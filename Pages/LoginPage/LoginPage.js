function switchState(state) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');

    if (state === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if redirected from email verification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        const alertBox = document.getElementById('verificationAlert');
        if (alertBox) alertBox.style.display = 'flex';
        switchState('login');
    }

    // Handle Login Submission
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // <--- Crucial: allows browser to store HttpOnly cookie
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // REMOVED: localStorage.setItem('token', data.token); -> Token is now securely stored in cookie!
            localStorage.setItem('userName', data.name); // Non-sensitive UI metadata is fine in localStorage

            window.showSuccessModal(`Welcome back, ${data.name}!`, 'Login Successful', () => {
                window.location.href = '../LandingPage/LandingPage.html';
            });
        } catch (err) {
            window.showErrorModal(err.message, 'Login Failed');
        }
    });

    // Handle Signup Submission
    const signupForm = document.getElementById('signupForm');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('signupPhone').value;
        const password = document.getElementById('signupPassword').value;

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Signup failed');
            }

            window.showSuccessModal(data.message, 'Account Created', () => {
                signupForm.reset();
                switchState('login');
            });
        } catch (err) {
            window.showErrorModal(err.message, 'Signup Failed');
        }
    });
});