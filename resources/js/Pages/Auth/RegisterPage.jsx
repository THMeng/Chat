import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function RegisterPage() {
    const [form, setForm]   = useState({ name: '', email: '', password: '', password_confirmation: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const { register } = useAuthStore();
    const navigate     = useNavigate();

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setErrors({});
        setLoading(true);
        try {
            await register(form.name, form.email, form.password, form.password_confirmation);
            navigate('/');
        } catch (err) {
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                setErrors({ general: 'Registration failed. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">💬</div>
                    <h1>Create account</h1>
                    <p>Start chatting today</p>
                </div>

                {errors.general && <div className="alert alert-error">{errors.general}</div>}

                <form onSubmit={submit} className="auth-form">
                    <div className="form-group">
                        <label>Name</label>
                        <input type="text" name="name" value={form.name} onChange={handle} placeholder="Your name" required />
                        {errors.name && <span className="field-error">{errors.name[0]}</span>}
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value={form.email} onChange={handle} placeholder="you@example.com" required />
                        {errors.email && <span className="field-error">{errors.email[0]}</span>}
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" name="password" value={form.password} onChange={handle} placeholder="••••••••" required />
                        {errors.password && <span className="field-error">{errors.password[0]}</span>}
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input type="password" name="password_confirmation" value={form.password_confirmation} onChange={handle} placeholder="••••••••" required />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}