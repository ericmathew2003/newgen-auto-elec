import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      localStorage.setItem("token", res.data.token);
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
            <motion.div whileHover={{ scale: 1.01 }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
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
            <motion.div whileHover={{ scale: 1.01 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
              />
            </motion.div>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-600 text-sm font-medium"
            >
              {error}
            </motion.p>
          )}

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
        </form>
      </motion.div>
    </div>
  );
}