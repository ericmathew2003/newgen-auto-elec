import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";

export default function LandingPage() {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = () => {
    setIsConnecting(true);
    setTimeout(() => navigate("/login"), 1500);
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const floatingAnimation = {
    y: [-5, 5, -5],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
  };

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="min-h-screen relative overflow-hidden bg-gray-900 dark:bg-gray-950 transition-colors duration-200"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-gray-800 to-indigo-900">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-24 sm:w-32 h-24 sm:h-32 bg-gray-700 rounded-full blur-xl opacity-60"></div>
          <div className="absolute top-1/3 right-1/4 w-28 sm:w-40 h-28 sm:h-40 bg-gray-600 rounded-full blur-xl opacity-50"></div>
          <div className="absolute bottom-1/4 left-1/3 w-24 sm:w-36 h-24 sm:h-36 bg-gray-700 rounded-full blur-xl opacity-40"></div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-12 md:py-16"
      >
        <div className="relative">
          <motion.div
            variants={fadeInUp}
            className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl"
          >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col sm:flex-row justify-between items-center mb-10 sm:mb-16 gap-6">
              <div className="flex items-center gap-3">
                <motion.img
                  src="/shoplogo.png"
                  alt="NewGen"
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                  animate={floatingAnimation}
                />
                <span className="text-lg sm:text-xl font-semibold text-white tracking-wide">
                  NEWGEN
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={isConnecting}
                className="px-5 py-2 sm:px-6 sm:py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm sm:text-base"
              >
                {isConnecting ? "Connecting..." : "Get started"}
              </motion.button>
            </motion.div>

            {/* Content */}
            <div className="text-center lg:text-left space-y-6 sm:space-y-8">
              <motion.h1 
                variants={fadeInUp}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight"
              >
                NewGen Automobile Spare Parts & Electric
              </motion.h1>
              <motion.p 
                variants={item}
                className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                Your trusted partner in automotive excellence. Premium spare parts,
                electrical components, and expert service for optimal vehicle performance.
              </motion.p>
              <motion.div variants={item}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogin}
                  disabled={isConnecting}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all duration-300 flex items-center gap-2 sm:gap-3 group mx-auto lg:mx-0 text-sm sm:text-base"
                >
                  {isConnecting ? (
                    <motion.span
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Connecting...
                    </motion.span>
                  ) : (
                    <>
                      <span>Explore our shop</span>
                      <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="relative z-10 border-t border-white/10 bg-white/5 backdrop-blur-xl mt-24 sm:mt-32"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <img src="/shoplogo.png" alt="NewGen" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
              <span className="text-xl sm:text-2xl font-semibold text-white">
                NewGen Automobile Spare Parts & Electric
              </span>
            </div>
            <p className="text-gray-300 text-sm sm:text-base mb-6 max-w-2xl mx-auto">
              Your trusted partner in automotive excellence. Premium spare parts, electrical components, and expert service for optimal vehicle performance.
            </p>
            <div className="text-xs sm:text-sm text-gray-400">
              &copy; 2024 NewGen. All rights reserved.
            </div>
          </div>
        </div>
      </motion.footer>
    </motion.main>
  );
}
