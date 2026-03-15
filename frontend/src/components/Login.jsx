import React, { useState } from 'react';
import { API_BASE } from '../config';

const API = `${API_BASE}/users`;

export default function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState('student');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('serverUrl') || '');
    const [serverSaved, setServerSaved] = useState(false);

    const handleSaveServer = () => {
        const trimmed = serverUrl.trim().replace(/\/+$/, '');
        if (trimmed) {
            localStorage.setItem('serverUrl', trimmed);
        } else {
            localStorage.removeItem('serverUrl');
        }
        setServerSaved(true);
        setTimeout(() => setServerSaved(false), 2000);
        // Reload so config.js and socket.js pick up the new URL
        window.location.reload();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        const url = isLogin ? `${API}/login` : API;
        const body = isLogin ? { email, password } : { name, email, password, role, otp };
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('userInfo', JSON.stringify(data));
                // Cache this user's credentials locally for offline/fallback login
                const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                localUsers[email] = { ...data, password };
                localStorage.setItem('registeredUsers', JSON.stringify(localUsers));
                onLogin(data);
            }
            else {
                // Server returned error (e.g. "MongoDB disconnected") — try local cache
                if (isLogin) {
                    const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                    if (localUsers[email] && localUsers[email].password === password) {
                        const cachedUser = localUsers[email];
                        localStorage.setItem('userInfo', JSON.stringify(cachedUser));
                        onLogin(cachedUser);
                        return;
                    }
                }
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            // --- OFFLINE MODE FALLBACK ---
            // First check locally registered users
            const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
            if (localUsers[email] && localUsers[email].password === password) {
                const cachedUser = localUsers[email];
                localStorage.setItem('userInfo', JSON.stringify(cachedUser));
                onLogin(cachedUser);
                return;
            }

            const cachedUser = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null;

            // Allow Test Accounts to login offline automatically
            if (email === 'admin@nabha.edu') {
                const dummyAdmin = { _id: 'admin1', name: 'System Admin', email, role: 'admin', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyAdmin));
                onLogin(dummyAdmin);
            }
            else if (email === 'teacher@nabha.edu') {
                const dummyTeacher = { _id: 'teacher1', name: 'Master Ji', email, role: 'teacher', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyTeacher));
                onLogin(dummyTeacher);
            }
            else if (email === 'aarav@student.nabha.edu') {
                const dummyStudent = { _id: 'student1', name: 'Aarav Kumar', email, role: 'student', token: 'offline-token' };
                localStorage.setItem('userInfo', JSON.stringify(dummyStudent));
                onLogin(dummyStudent);
            }
            // Allow cached real users to login offline
            else if (cachedUser && cachedUser.email === email) {
                onLogin(cachedUser);
            }
            // No offline data available
            else {
                setError('Device is offline. Please use matching cached account or connect to internet.');
            }
        }
        finally { setLoading(false); }
    };

    const handleSendOtp = async () => {
        if (!email) {
            setError('Please enter your email first.');
            return;
        }
        setSendingOtp(true); setError('');
        try {
            const res = await fetch(`${API}/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            
            if (res.status === 404) {
                setError('Backend route not found. Please restart your Node server!');
                return;
            }

            let data;
            try {
                data = await res.json();
            } catch (jsonErr) {
                throw new Error('Server returned invalid response (possibly HTML)');
            }

            if (res.ok || (data.message && data.message.includes('mocked'))) {
                setOtpSent(true);
                alert(`OTP sent to ${email}.\nFor this demo, check the backend terminal console for the code!`);
            } else {
                setError(data.message || 'Failed to send OTP');
            }
        } catch (err) {
            console.error('OTP Send Error:', err);
            setError(err.message === 'Failed to fetch' ? 'Network connection refused. Is the server running?' : `Error: ${err.message}`);
        } finally {
            setSendingOtp(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans p-4">
            <div className="w-full max-w-sm space-y-8">

                {/* Logo */}
                <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-lg shadow-indigo-600/30">🎓</div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Vidya Setu</h1>
                    <p className="text-sm text-slate-400 font-semibold mt-1">Digital Learning · Nabha Rural Schools</p>
                </div>

                {/* Role Toggle */}
                <div className="bg-slate-800 rounded-2xl p-1 flex">
                    <button onClick={() => setRole('student')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${role === 'student' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>🧑‍🎓 Student</button>
                    <button onClick={() => setRole('teacher')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${role === 'teacher' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>👩‍🏫 Teacher</button>
                </div>

                <h2 className="text-lg font-bold text-white text-center">{isLogin ? 'Sign in to your account' : 'Create your account'}</h2>

                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center"><p className="text-red-400 text-sm font-semibold">{error}</p></div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isLogin ? (
                        <>
                            <div>
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">{role === 'student' ? 'School ID or Email' : 'Teacher ID or Email'}</label>
                                <input type="text" value={email} onChange={e => setEmail(e.target.value)} required
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors" placeholder={role === 'student' ? 'School ID or Email' : 'Teacher ID or Email'} />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors pr-12" placeholder="Password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-500 text-lg">{showPassword ? '🙈' : '👁'}</button>
                                </div>
                            </div>
                            <p className="text-right"><button type="button" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">Forgot password?</button></p>

                            <button type="submit" disabled={loading}
                                className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${loading ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'}`}>
                                {loading ? <span className="animate-pulse">Signing in...</span> : 'Sign In →'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Email Address</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={otpSent}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors disabled:opacity-50" placeholder="Enter your email" />
                            </div>

                            {!otpSent ? (
                                <button type="button" onClick={handleSendOtp} disabled={sendingOtp}
                                    className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${sendingOtp ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'}`}>
                                    {sendingOtp ? <span className="animate-pulse">Sending OTP...</span> : 'Send OTP →'}
                                </button>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 block mb-1.5">Enter 6-Digit OTP</label>
                                        <input type="text" value={otp} onChange={e => setOtp(e.target.value)} required maxLength="6"
                                            className="w-full bg-slate-800 border border-emerald-500/50 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-emerald-500 outline-none transition-colors tracking-widest text-center" placeholder="123456" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Full Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors" placeholder="Enter your full name" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Password</label>
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3.5 text-white font-semibold text-sm focus:border-indigo-500 outline-none transition-colors pr-12" placeholder="Create a password" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-500 text-lg">{showPassword ? '🙈' : '👁'}</button>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading}
                                        className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all ${loading ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'}`}>
                                        {loading ? <span className="animate-pulse">Creating Account...</span> : 'Verify & Create Account ✓'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </form>

                {role === 'student' && isLogin && (
                    <p className="text-center"><button className="text-sm font-semibold text-indigo-400">Or login with OTP →</button></p>
                )}

                <p className="text-center text-sm text-slate-400 font-semibold">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); setOtpSent(false); setOtp(''); }} className="text-indigo-400 font-bold hover:text-indigo-300">{isLogin ? 'Sign Up' : 'Sign In'}</button>
                </p>

                {/* Language Footer */}
                <p className="text-center text-xs text-slate-500 font-semibold">Supports English · ਪੰਜਾਬੀ · हिंदी</p>


                {/* Server Configuration */}
                <div className="pt-2">
                    <button onClick={() => setShowServerConfig(!showServerConfig)} className="w-full text-center text-[11px] text-slate-500 font-semibold hover:text-slate-300 transition-colors">
                        {showServerConfig ? '▾ Hide Server Settings' : '⚙ Server Settings'}
                        {localStorage.getItem('serverUrl') && !showServerConfig && <span className="text-emerald-500 ml-1">● Connected</span>}
                    </button>
                    {showServerConfig && (
                        <div className="mt-3 bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Server URL</p>
                            <input
                                type="url"
                                value={serverUrl}
                                onChange={e => setServerUrl(e.target.value)}
                                placeholder="http://192.168.x.x:5001"
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold text-sm focus:border-indigo-500 outline-none"
                            />
                            <p className="text-[10px] text-slate-600 font-semibold">Enter the full URL of your backend server. Both devices must be reachable over the network. Leave empty for localhost (browser default).</p>
                            <button onClick={handleSaveServer} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white active:scale-95 transition-all">
                                {serverSaved ? '✓ Saved — Reloading...' : 'Save & Reconnect'}
                            </button>
                            {localStorage.getItem('serverUrl') && (
                                <p className="text-[10px] text-emerald-400 font-semibold text-center">Current: {localStorage.getItem('serverUrl')}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Institution Footer */}
                <p className="text-center text-[10px] text-slate-600 font-semibold">SIH2025 · Matrusri Engineering College</p>
            </div>
        </div>
    );
}
