'use client';

import { motion } from 'framer-motion';
import { FolderPlus, Link2, Share2 } from 'lucide-react';

const steps = [
  {
    icon: FolderPlus,
    title: 'Create Collections',
    description: 'Group your resources into clean, themed spaces.',
    details: 'Each collection can include links, videos, articles, tools, images, and more.',
    imageSide: 'right' as const,
  },
  {
    icon: Link2,
    title: 'Add Cards',
    description: 'Save any resource as a Card—manually or with our browser extension.',
    details: 'Stacq automatically fetches metadata, thumbnails, and descriptions for you.',
    imageSide: 'left' as const,
  },
  {
    icon: Share2,
    title: 'Share & Discover',
    description: 'Publish your collections, follow Stacqers, explore trending topics, and',
    details: 'find high-quality resources curated by real people.',
    imageSide: 'right' as const,
  },
];

export function HowItWorksSection() {
  return (
    <section className="container mx-auto px-4 md:px-page py-12 md:py-16 lg:py-20 xl:py-24 bg-white">
      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-light to-transparent mb-12 md:mb-16"></div>
      
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="text-center mb-8 md:mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-jet-dark mb-3 md:mb-4">
            How Stacq works
          </h2>
          <div className="w-12 md:w-16 h-1 bg-emerald mx-auto rounded-full"></div>
        </motion.div>
        
        <div className="space-y-12 md:space-y-16 lg:space-y-24">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isEven = index % 2 === 0;
            const isLeft = step.imageSide === 'left';
            
            return (
              <motion.div
                key={index}
                className={`flex flex-col ${isLeft ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-6 md:gap-8 lg:gap-12`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                {/* Content */}
                <div className={`flex-1 w-full ${isLeft ? 'lg:text-right' : 'lg:text-left'} text-center lg:text-left`}>
                  <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-emerald text-white rounded-xl mb-4 md:mb-6 shadow-button">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-jet-dark mb-3 md:mb-4">
                    {step.title}
                  </h3>
                  <p className="text-base sm:text-lg md:text-xl text-gray-muted mb-2 md:mb-3 leading-relaxed">
                    {step.description}
                  </p>
                  <p className="text-sm sm:text-base md:text-lg text-gray-muted leading-relaxed">
                    {step.details}
                  </p>
                </div>

                {/* Image Placeholder */}
                <div className={`flex-1 w-full ${isLeft ? 'lg:pr-4 lg:pr-8' : 'lg:pl-4 lg:pl-8'}`}>
                  <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 rounded-card bg-gradient-to-br from-emerald/10 via-emerald/5 to-cloud border border-gray-light overflow-hidden shadow-card">
                    {/* Decorative illustration placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-5xl sm:text-6xl md:text-8xl opacity-20">
                        {index === 0 && '📁'}
                        {index === 1 && '🔗'}
                        {index === 2 && '🌐'}
                      </div>
                    </div>
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald/20 to-transparent"></div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

