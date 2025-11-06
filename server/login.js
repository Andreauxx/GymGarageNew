// Assuming your login.js has a login function 
// THIS IS NOTTT BEING USEDD ANYMOREEE
async function loginUser(email, password) {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token); // Store the token
        window.location.href = '/'; // Redirect to home after login
    } else {
        alert('Login failed');
    }
}

function isAdmin(req, res, next) {
  if (req.session?.role === 'admin') return next();
  return res.status(403).json({ message: 'Admins only' });
}
