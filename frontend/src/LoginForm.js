import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiUser, FiLock, FiEye, FiEyeOff, FiCheckCircle } from "react-icons/fi";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        username: username.trim(),
        password: password.trim(),
      });
      if (remember) {
        localStorage.setItem("token", res.data.token);
      } else {
        sessionStorage.setItem("token", res.data.token);
      }
      navigate("/select-period");
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        when: "beforeChildren"
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      {/* Background elements */}
      <motion.div 
        className="fixed inset-0 -z-10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-100 rounded-full filter blur-3xl opacity-40"></div>
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-gray-200 rounded-full filter blur-3xl opacity-40"></div>
      </motion.div>

      {/* Login card */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={container}
        className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-gray-200"
      >
        {/* Logo */}
        <motion.div 
          variants={item}
          className="flex justify-center mb-6"
        >
          <motion.img 
            src="/logo2.png" 
            alt="NewGen Logo"
            className="h-16 w-auto"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          />
        </motion.div>

        {/* Title */}
        <motion.h2 
          variants={item}
          className="text-center text-3xl font-bold text-gray-900 mb-2"
        >
          Welcome Back
        </motion.h2>
        
        <motion.p 
          variants={item}
          className="text-center text-gray-600 mb-8"
        >
          Sign in to your account
        </motion.p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username */}
          <motion.div variants={item}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <motion.div whileHover={{ scale: 1.01 }} className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiUser size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                autoComplete="username"
              />
            </motion.div>
          </motion.div>

          {/* Password */}
          <motion.div variants={item}>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <motion.a
                href="#"
                className="text-sm text-red-600 hover:text-red-800"
                whileHover={{ x: 2 }}
              >
                Forgot password?
              </motion.a>
            </div>
            <motion.div whileHover={{ scale: 1.01 }} className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiLock size={18} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </motion.div>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium"
            >
              {error}
            </motion.p>
          )}

          {/* Remember me */}
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in
            </label>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              <FiCheckCircle />
              Secure login
            </div>
          </div>

          {/* Sign In Button */}
          <motion.button
            variants={item}
            whileHover={{ scale: 1.03, boxShadow: "0 4px 15px rgba(220, 38, 38, 0.2)" }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all duration-200"
          >
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                ></path>
              </svg>
            ) : (
              "SIGN IN"
            )}
          </motion.button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-4">
            By signing in you agree to our <a className="underline hover:text-gray-700" href="#">Terms</a> & <a className="underline hover:text-gray-700" href="#">Privacy</a>.
          </p>
        </form>
      </motion.div>
    </div>
  );
}