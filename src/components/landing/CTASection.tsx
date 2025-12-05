'use client';

import { motion } from 'framer-motion';
import { LandingPageCTAButtons } from './LandingPageButtons';

export function CTASection() {
  return (
    <motion.div 
      className="relative bg-gradient-to-br from-emerald to-emerald-dark text-white py-16 md:py-20 lg:py-24 overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 md:px-page text-center relative z-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 px-2">Ready to start collecting?</h2>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 md:mb-10 opacity-95 max-w-2xl mx-auto leading-relaxed px-2">
          Join thousands of users creating and sharing amazing resource collections. 
          Start building your knowledge base today.
        </p>
        <LandingPageCTAButtons />
      </div>
    </motion.div>
  );
}

