'use client';

import { motion } from 'framer-motion';
import { LandingPageButtons } from './LandingPageButtons';

export function HeroSection() {
  return (
    <motion.div 
      className="relative bg-gradient-to-br from-emerald/5 via-cloud to-emerald/3 py-16 md:py-20 lg:py-28 xl:py-32 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald/8 rounded-full blur-2xl"></div>
      </div>
      
      <div className="container mx-auto px-4 md:px-page relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-jet-dark mb-4 md:mb-6 leading-tight px-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Discover and organize the best resources—<span className="text-emerald">curated by real people</span>
          </motion.h1>
          <motion.p 
            className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-muted mb-4 md:mb-6 leading-relaxed px-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Stacq is a platform where you save links, notes, tools, and ideas into themed Collections.
          </motion.p>
          <motion.p 
            className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-muted mb-8 md:mb-10 leading-relaxed px-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Add Cards, explore what others are curating, and build a smarter knowledge base together.
          </motion.p>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <LandingPageButtons />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

