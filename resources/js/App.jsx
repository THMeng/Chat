import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage    from './Pages/Auth/LoginPage';
import RegisterPage from './Pages/Auth/RegisterPage';
import ChatLayout   from './Pages/Chat/ChatLayout';

function PrivateRoute({ children }) {
    const { token } = useAuthStore();
    return token ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
    const { token } = useAuthStore();
    return !token ? children : <Navigate to="/" replace />;
}

export default function App() {
    const { token, fetchMe } = useAuthStore();

    useEffect(() => {
        if (token) fetchMe();
    }, [token]);

    return (
        <Routes>
            <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/*"        element={<PrivateRoute><ChatLayout /></PrivateRoute>} />
        </Routes>
    );
}